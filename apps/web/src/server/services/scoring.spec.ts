import { describe, it, expect, vi } from 'vitest';
import { BusinessError } from '../errors';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
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
  updatedAt?: Date;
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

let currentFakeDb: ReturnType<typeof makeFakeDb>;

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
      findFirst: vi.fn(async () => {
        if (finalMode) {
          return fixtures.find(
            (f) => f.stage === 'final' && f.status === 'finished'
          );
        }
        return fixtures.find((f) => f.id === targetFixtureId);
      }),
    },
    predictions: {
      findMany: vi.fn(async () =>
        predictions.filter((p) => p.fixtureId === targetFixtureId)
      ),
    },
  };

  const fakeDb = {
    _fixtures: fixtures,
    _predictions: predictions,
    query: queryApi,
    update: vi.fn(updateBuilder),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = { query: queryApi, update: vi.fn(updateBuilder) };
      await cb(tx);
    }),
  };

  return fakeDb;
}

vi.mock('@pitchpredict/db', () => ({
  db: new Proxy({} as ReturnType<typeof makeFakeDb>, {
    get(_target, prop) {
      return (currentFakeDb as Record<string | symbol, unknown>)[prop];
    },
  }),
  schema: {
    fixtures: {
      id: { name: 'id' },
      stage: { name: 'stage' },
      status: { name: 'status' },
    },
    predictions: {
      id: { name: 'id' },
      fixtureId: { name: 'fixtureId' },
      pointsAwarded: { name: 'pointsAwarded' },
    },
  },
}));

const { pointsFor, scoreFixture, championTeamId, EXACT, DIFFERENCE, TENDENCY, CHAMPION_BONUS } = await import('./scoring');

describe('pointsFor', () => {
  it('awards 4 for an exact scoreline (2-1 vs 2-1)', () => {
    expect(pointsFor(2, 1, 2, 1)).toBe(4);
  });

  it('awards 3 for the correct goal difference (3-2 vs 2-1)', () => {
    expect(pointsFor(3, 2, 2, 1)).toBe(3);
  });

  it('awards 3 for a draw predicted as a draw with the wrong score (1-1 vs 2-2)', () => {
    expect(pointsFor(1, 1, 2, 2)).toBe(3);
  });

  it('awards 2 for the correct tendency only (1-0 vs 3-1)', () => {
    expect(pointsFor(1, 0, 3, 1)).toBe(2);
  });

  it('awards 0 for a wrong outcome (0-0 vs 1-0)', () => {
    expect(pointsFor(0, 0, 1, 0)).toBe(0);
  });

  it('uses the exact constants', () => {
    expect(EXACT).toBe(4);
    expect(DIFFERENCE).toBe(3);
    expect(TENDENCY).toBe(2);
    expect(CHAMPION_BONUS).toBe(10);
  });
});

describe('scoreFixture', () => {
  it('throws if the fixture is not finished', async () => {
    currentFakeDb = makeFakeDb({
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
    await expect(scoreFixture(1)).rejects.toBeInstanceOf(BusinessError);
  });

  it('recomputes pointsAwarded for every prediction of the fixture', async () => {
    currentFakeDb = makeFakeDb({
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

    await scoreFixture(1);

    const byId = (id: number) => currentFakeDb._predictions.find((p) => p.id === id);
    expect(byId(100)?.pointsAwarded).toBe(4);
    expect(byId(101)?.pointsAwarded).toBe(3);
    expect(byId(102)?.pointsAwarded).toBe(2);
    expect(byId(103)?.pointsAwarded).toBe(0);
  });

  it('is idempotent: re-scoring yields the same points', async () => {
    currentFakeDb = makeFakeDb({
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

    await scoreFixture(1);
    expect(currentFakeDb._predictions[0].pointsAwarded).toBe(4);
    await scoreFixture(1);
    expect(currentFakeDb._predictions[0].pointsAwarded).toBe(4);
  });
});

describe('championTeamId', () => {
  it('returns null when there is no finished final', async () => {
    currentFakeDb = makeFakeDb({ fixtures: [], predictions: [], finalMode: true });
    expect(await championTeamId()).toBeNull();
  });

  it('returns null when the final ended level', async () => {
    currentFakeDb = makeFakeDb({
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
    expect(await championTeamId()).toBeNull();
  });

  it('returns the home team id when the home side won the final', async () => {
    currentFakeDb = makeFakeDb({
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
    expect(await championTeamId()).toBe(10);
  });

  it('returns the away team id when the away side won the final', async () => {
    currentFakeDb = makeFakeDb({
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
    expect(await championTeamId()).toBe(20);
  });
});
