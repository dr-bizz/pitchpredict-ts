import { LeaderboardService } from './leaderboard.service';
import { ScoringService } from '../scoring/scoring.service';
import type { DrizzleDb } from '../db/db.module';

jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return {
    ...actual,
    eq: () => ({ __pred: true }),
    and: () => ({ __pred: true }),
    sql: () => ({ __sql: true }),
  };
});

/** One pre-aggregated user row, as the grouped SELECT would return it. */
interface AggRow {
  id: number;
  name: string;
  email: string;
  role: 'player' | 'admin';
  totalPoints: number;
  predictionsCount: number;
  exactCount: number;
  diffCount: number;
  tendencyCount: number;
}

/**
 * Fake db serving:
 *  - the grouped aggregate (db.select(...).from(users).leftJoin(...).groupBy(...))
 *    resolves to the canned AggRow[]
 *  - the champion-pick user-id query (db.select(...).from(championPicks).where(...))
 *    resolves to the canned [{ userId }]
 * We disambiguate the two SELECTs by whether `.groupBy` is called.
 */
function makeFakeDb(opts: {
  aggregate: AggRow[];
  championUserIds: number[];
}) {
  const aggregate = opts.aggregate;
  const championRows = opts.championUserIds.map((userId) => ({ userId }));

  const select = jest.fn(() => {
    const builder: Record<string, unknown> = {};
    let isGrouped = false;
    builder['from'] = () => builder;
    builder['leftJoin'] = () => builder;
    builder['where'] = () => builder;
    builder['groupBy'] = () => {
      isGrouped = true;
      return builder;
    };
    // Resolve when awaited.
    builder['then'] = (resolve: (v: unknown) => void) => {
      resolve(isGrouped ? aggregate : championRows);
    };
    return builder;
  });

  const db = { select };
  return db as unknown as DrizzleDb;
}

function makeService(opts: {
  aggregate: AggRow[];
  championUserIds: number[];
  championTeamId: number | null;
}) {
  const db = makeFakeDb(opts);
  const scoring = {
    championTeamId: jest.fn(async () => opts.championTeamId),
  } as unknown as ScoringService;
  return new LeaderboardService(db, scoring);
}

const user = (
  id: number,
  name: string,
  over: Partial<AggRow> = {}
): AggRow => ({
  id,
  name,
  email: `${name.toLowerCase()}@example.com`,
  role: 'player',
  totalPoints: 0,
  predictionsCount: 0,
  exactCount: 0,
  diffCount: 0,
  tendencyCount: 0,
  ...over,
});

describe('LeaderboardService.rows', () => {
  it('orders by total desc, then exact desc, then name asc', async () => {
    const service = makeService({
      aggregate: [
        user(1, 'Charlie', { totalPoints: 10, exactCount: 1 }),
        // Alice and Bob have equal totals -> the exact-count tiebreak puts Bob
        // (5) ahead of Alice (2) for display, but they share a rank.
        user(2, 'Alice', { totalPoints: 20, exactCount: 2 }),
        user(3, 'Bob', { totalPoints: 20, exactCount: 5 }),
      ],
      championUserIds: [],
      championTeamId: null,
    });

    const rows = await service.rows();
    expect(rows.map((r) => r.user.name)).toEqual(['Bob', 'Alice', 'Charlie']);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('uses name asc to break a full exact-count tie for display order', async () => {
    const service = makeService({
      aggregate: [
        user(1, 'Yana', { totalPoints: 20, exactCount: 2 }),
        user(2, 'Xena', { totalPoints: 20, exactCount: 2 }),
      ],
      championUserIds: [],
      championTeamId: null,
    });

    const rows = await service.rows();
    expect(rows.map((r) => r.user.name)).toEqual(['Xena', 'Yana']);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('breaks total ties by exact count, then name (rank still by total only)', async () => {
    const service = makeService({
      aggregate: [
        user(1, 'Zara', { totalPoints: 15, exactCount: 1 }),
        user(2, 'Anna', { totalPoints: 15, exactCount: 1 }),
      ],
      championUserIds: [],
      championTeamId: null,
    });

    const rows = await service.rows();
    expect(rows.map((r) => r.user.name)).toEqual(['Anna', 'Zara']);
    // Equal totals share rank under standard competition ranking.
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('assigns standard competition ranking (1,1,3) on equal totals', async () => {
    const service = makeService({
      aggregate: [
        user(1, 'Alice', { totalPoints: 20 }),
        user(2, 'Bob', { totalPoints: 20 }),
        user(3, 'Cara', { totalPoints: 5 }),
      ],
      championUserIds: [],
      championTeamId: null,
    });

    const rows = await service.rows();
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('does not apply the champion bonus before the final has finished', async () => {
    const service = makeService({
      aggregate: [user(1, 'Alice', { totalPoints: 12 })],
      championUserIds: [1],
      championTeamId: null,
    });

    const rows = await service.rows();
    expect(rows[0].totalPoints).toBe(12);
  });

  it('adds the +10 champion bonus only to users who picked the champion', async () => {
    const service = makeService({
      aggregate: [
        user(1, 'Alice', { totalPoints: 12 }),
        user(2, 'Bob', { totalPoints: 12 }),
      ],
      championUserIds: [1], // only Alice picked the champion
      championTeamId: 99,
    });

    const rows = await service.rows();
    const byName = Object.fromEntries(rows.map((r) => [r.user.name, r]));
    expect(byName['Alice'].totalPoints).toBe(22);
    expect(byName['Bob'].totalPoints).toBe(12);
    // The bonus reorders Alice above Bob and bumps Bob to rank 2.
    expect(rows.map((r) => r.user.name)).toEqual(['Alice', 'Bob']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('exposes the per-user counts and a public user (no passwordHash)', async () => {
    const service = makeService({
      aggregate: [
        user(1, 'Alice', {
          totalPoints: 9,
          predictionsCount: 4,
          exactCount: 1,
          diffCount: 1,
          tendencyCount: 1,
        }),
      ],
      championUserIds: [],
      championTeamId: null,
    });

    const [row] = await service.rows();
    expect(row.predictionsCount).toBe(4);
    expect(row.exactCount).toBe(1);
    expect(row.diffCount).toBe(1);
    expect(row.tendencyCount).toBe(1);
    expect(row.user).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'player',
    });
  });
});
