import { describe, it, expect, vi } from 'vitest';
import { BusinessError, NotFoundError } from '../errors';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      if (column?.name === 'fixtureId') return { __fixtureId: value };
      return { __pred: true };
    },
    inArray: (_column: unknown, values: number[]) => ({ __inArray: values }),
  };
});

// scoreFixture is only exercised by enterResult; assignTeams never calls it.
vi.mock('./scoring', () => ({ scoreFixture: vi.fn(async () => undefined) }));

interface FixtureRow {
  id: number;
  stage: string;
  status: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam?: unknown;
  awayTeam?: unknown;
  stadium?: unknown;
}

interface TeamRow {
  id: number;
}

function makeFakeDb(opts: { fixtures: FixtureRow[]; teams: TeamRow[] }) {
  const fixtures = opts.fixtures;
  const teams = opts.teams;

  const queryApi = {
    fixtures: {
      findFirst: vi.fn(
        async ({ where }: { where: { __fixtureId?: number } }) =>
          fixtures.find((f) => f.id === where.__fixtureId)
      ),
    },
    teams: {
      findMany: vi.fn(async ({ where }: { where: { __inArray?: number[] } }) =>
        teams.filter((t) => (where.__inArray ?? []).includes(t.id))
      ),
    },
  };

  const fakeDb = {
    _fixtures: fixtures,
    query: queryApi,
    update: vi.fn(() => ({
      set: (vals: Partial<FixtureRow>) => ({
        where: async (pred: { __fixtureId?: number }) => {
          const row = fixtures.find((f) => f.id === pred.__fixtureId);
          if (row) Object.assign(row, vals);
        },
      }),
    })),
  };
  return fakeDb;
}

let currentFakeDb: ReturnType<typeof makeFakeDb>;

vi.mock('@pitchpredict/db', () => ({
  db: new Proxy({} as ReturnType<typeof makeFakeDb>, {
    get(_target, prop) {
      return (currentFakeDb as Record<string | symbol, unknown>)[prop];
    },
  }),
  schema: {
    fixtures: { id: { name: 'fixtureId' } },
    teams: { id: { name: 'teamsId' } },
  },
}));

const { assignTeams } = await import('./admin-fixtures');

describe('assignTeams', () => {
  it('assigns two distinct existing teams to a knockout fixture (happy path)', async () => {
    currentFakeDb = makeFakeDb({
      fixtures: [
        { id: 1, stage: 'qf', status: 'scheduled', homeTeamId: null, awayTeamId: null },
      ],
      teams: [{ id: 10 }, { id: 20 }],
    });

    const result = await assignTeams(1, { homeTeamId: 10, awayTeamId: 20 });

    expect(result.homeTeamId).toBe(10);
    expect(result.awayTeamId).toBe(20);
    expect(result.locked).toBe(false);
    expect(currentFakeDb._fixtures[0].homeTeamId).toBe(10);
    expect(currentFakeDb._fixtures[0].awayTeamId).toBe(20);
  });

  it('allows clearing both teams back to null without a teams lookup', async () => {
    currentFakeDb = makeFakeDb({
      fixtures: [
        { id: 1, stage: 'qf', status: 'scheduled', homeTeamId: 10, awayTeamId: 20 },
      ],
      teams: [{ id: 10 }, { id: 20 }],
    });

    const result = await assignTeams(1, { homeTeamId: null, awayTeamId: null });

    expect(result.homeTeamId).toBeNull();
    expect(result.awayTeamId).toBeNull();
    expect(currentFakeDb.query.teams.findMany).not.toHaveBeenCalled();
  });

  it('rejects reassigning a group-stage fixture with 422', async () => {
    currentFakeDb = makeFakeDb({
      fixtures: [
        { id: 1, stage: 'group', status: 'scheduled', homeTeamId: 10, awayTeamId: 20 },
      ],
      teams: [{ id: 10 }, { id: 20 }],
    });

    await expect(
      assignTeams(1, { homeTeamId: 30, awayTeamId: 40 })
    ).rejects.toBeInstanceOf(BusinessError);
    expect(currentFakeDb.update).not.toHaveBeenCalled();
  });

  it('rejects two identical teams with 422', async () => {
    currentFakeDb = makeFakeDb({
      fixtures: [
        { id: 1, stage: 'qf', status: 'scheduled', homeTeamId: null, awayTeamId: null },
      ],
      teams: [{ id: 10 }],
    });

    await expect(
      assignTeams(1, { homeTeamId: 10, awayTeamId: 10 })
    ).rejects.toBeInstanceOf(BusinessError);
    expect(currentFakeDb.update).not.toHaveBeenCalled();
  });

  it('rejects a team id that does not reference an existing team with 422', async () => {
    currentFakeDb = makeFakeDb({
      fixtures: [
        { id: 1, stage: 'qf', status: 'scheduled', homeTeamId: null, awayTeamId: null },
      ],
      teams: [{ id: 10 }], // 99 is missing
    });

    await expect(
      assignTeams(1, { homeTeamId: 10, awayTeamId: 99 })
    ).rejects.toBeInstanceOf(BusinessError);
    expect(currentFakeDb.update).not.toHaveBeenCalled();
  });

  it('throws 404 when the fixture does not exist', async () => {
    currentFakeDb = makeFakeDb({ fixtures: [], teams: [{ id: 10 }, { id: 20 }] });

    await expect(
      assignTeams(999, { homeTeamId: 10, awayTeamId: 20 })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
