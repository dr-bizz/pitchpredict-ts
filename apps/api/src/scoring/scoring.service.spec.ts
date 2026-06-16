import { BusinessException } from '../common/business.exception';
import { ScoringService } from './scoring.service';
import type { DrizzleDb } from '../db/db.module';

// eq(predictions.id, value) is the only equality the service relies on for the
// per-row update; we surface the value as `{ __id }` so the fake `where` can find
// the target prediction. Stage/status equalities collapse to inert markers.
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      if (column?.name === 'id') return { __id: value };
      return { __pred: true };
    },
    and: () => ({ __pred: true }),
  };
});

interface PredictionRow {
  id: number;
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number | null;
}

interface FixtureRow {
  id: number;
  stage: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: number;
  awayTeamId: number;
}

/**
 * In-memory stand-in for the slice of Drizzle the ScoringService uses:
 *  - query.fixtures.findFirst (the scored fixture by id, or the finished final)
 *  - query.predictions.findMany (all predictions of the fixture)
 *  - transaction(cb) — the callback gets a tx exposing
 *    update().set({pointsAwarded}).where(eq(predictions.id, p.id))
 */
function makeFakeDb(opts: {
  fixtures: FixtureRow[];
  predictions: PredictionRow[];
  finalMode?: boolean;
  targetFixtureId?: number;
}) {
  const fixtures = opts.fixtures;
  const predictions = opts.predictions;
  const finalMode = opts.finalMode ?? false;
  const targetFixtureId = opts.targetFixtureId ?? null;

  const updateBuilder = () => ({
    set: (vals: { pointsAwarded: number }) => ({
      where: async (pred: { __id?: number }) => {
        const row = predictions.find((p) => p.id === pred.__id);
        if (row) row.pointsAwarded = vals.pointsAwarded;
      },
    }),
  });

  const queryApi = {
    fixtures: {
      findFirst: jest.fn(async () => {
        if (finalMode) {
          return fixtures.find(
            (f) => f.stage === 'final' && f.status === 'finished'
          );
        }
        return fixtures.find((f) => f.id === targetFixtureId);
      }),
    },
    predictions: {
      findMany: jest.fn(async () =>
        predictions.filter((p) => p.fixtureId === targetFixtureId)
      ),
    },
  };

  const db = {
    _fixtures: fixtures,
    _predictions: predictions,
    query: queryApi,
    update: jest.fn(updateBuilder),
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = { query: queryApi, update: jest.fn(updateBuilder) };
      await cb(tx);
    }),
  };

  return db as unknown as DrizzleDb & {
    _fixtures: FixtureRow[];
    _predictions: PredictionRow[];
  };
}

describe('ScoringService.pointsFor', () => {
  const service = new ScoringService(
    makeFakeDb({ fixtures: [], predictions: [] })
  );

  it('awards 4 for an exact scoreline (2-1 vs 2-1)', () => {
    expect(service.pointsFor(2, 1, 2, 1)).toBe(4);
  });

  it('awards 3 for the correct goal difference (3-2 vs 2-1)', () => {
    expect(service.pointsFor(3, 2, 2, 1)).toBe(3);
  });

  it('awards 3 for a draw predicted as a draw with the wrong score (1-1 vs 2-2)', () => {
    expect(service.pointsFor(1, 1, 2, 2)).toBe(3);
  });

  it('awards 2 for the correct tendency only (1-0 vs 3-1)', () => {
    expect(service.pointsFor(1, 0, 3, 1)).toBe(2);
  });

  it('awards 0 for a wrong outcome (0-0 vs 1-0)', () => {
    expect(service.pointsFor(0, 0, 1, 0)).toBe(0);
  });

  it('uses the exact constants', () => {
    expect(ScoringService.EXACT).toBe(4);
    expect(ScoringService.DIFFERENCE).toBe(3);
    expect(ScoringService.TENDENCY).toBe(2);
    expect(ScoringService.CHAMPION_BONUS).toBe(10);
  });
});

describe('ScoringService.scoreFixture', () => {
  it('throws if the fixture is not finished', async () => {
    const db = makeFakeDb({
      fixtures: [
        {
          id: 1,
          stage: 'group',
          status: 'scheduled',
          homeScore: null,
          awayScore: null,
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      predictions: [],
      targetFixtureId: 1,
    });
    const service = new ScoringService(db);
    await expect(service.scoreFixture(1)).rejects.toBeInstanceOf(
      BusinessException
    );
  });

  it('recomputes pointsAwarded for every prediction of the fixture', async () => {
    const db = makeFakeDb({
      fixtures: [
        {
          id: 1,
          stage: 'group',
          status: 'finished',
          homeScore: 2,
          awayScore: 1,
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      predictions: [
        { id: 100, fixtureId: 1, homeScore: 2, awayScore: 1, pointsAwarded: null }, // exact -> 4
        { id: 101, fixtureId: 1, homeScore: 3, awayScore: 2, pointsAwarded: null }, // diff -> 3
        { id: 102, fixtureId: 1, homeScore: 3, awayScore: 0, pointsAwarded: null }, // tendency -> 2
        { id: 103, fixtureId: 1, homeScore: 0, awayScore: 0, pointsAwarded: null }, // wrong -> 0
      ],
      targetFixtureId: 1,
    });
    const service = new ScoringService(db);

    await service.scoreFixture(1);

    const byId = (id: number) => db._predictions.find((p) => p.id === id);
    expect(byId(100)?.pointsAwarded).toBe(4);
    expect(byId(101)?.pointsAwarded).toBe(3);
    expect(byId(102)?.pointsAwarded).toBe(2);
    expect(byId(103)?.pointsAwarded).toBe(0);
  });

  it('is idempotent: re-scoring yields the same points', async () => {
    const db = makeFakeDb({
      fixtures: [
        {
          id: 1,
          stage: 'group',
          status: 'finished',
          homeScore: 2,
          awayScore: 1,
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      predictions: [
        { id: 100, fixtureId: 1, homeScore: 2, awayScore: 1, pointsAwarded: 99 },
      ],
      targetFixtureId: 1,
    });
    const service = new ScoringService(db);

    await service.scoreFixture(1);
    expect(db._predictions[0].pointsAwarded).toBe(4);
    await service.scoreFixture(1);
    expect(db._predictions[0].pointsAwarded).toBe(4);
  });
});

describe('ScoringService.championTeamId', () => {
  it('returns null when there is no finished final', async () => {
    const db = makeFakeDb({ fixtures: [], predictions: [], finalMode: true });
    const service = new ScoringService(db);
    expect(await service.championTeamId()).toBeNull();
  });

  it('returns null when the final ended level', async () => {
    const db = makeFakeDb({
      fixtures: [
        {
          id: 9,
          stage: 'final',
          status: 'finished',
          homeScore: 1,
          awayScore: 1,
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      predictions: [],
      finalMode: true,
    });
    const service = new ScoringService(db);
    expect(await service.championTeamId()).toBeNull();
  });

  it('returns the home team id when the home side won the final', async () => {
    const db = makeFakeDb({
      fixtures: [
        {
          id: 9,
          stage: 'final',
          status: 'finished',
          homeScore: 3,
          awayScore: 1,
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      predictions: [],
      finalMode: true,
    });
    const service = new ScoringService(db);
    expect(await service.championTeamId()).toBe(10);
  });

  it('returns the away team id when the away side won the final', async () => {
    const db = makeFakeDb({
      fixtures: [
        {
          id: 9,
          stage: 'final',
          status: 'finished',
          homeScore: 0,
          awayScore: 2,
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      predictions: [],
      finalMode: true,
    });
    const service = new ScoringService(db);
    expect(await service.championTeamId()).toBe(20);
  });
});
