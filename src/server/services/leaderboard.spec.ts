import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
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

let mockAggregate: AggRow[] = [];
let mockChampionRows: { userId: number }[] = [];
let mockChampionTeamId: number | null = null;

vi.mock('@pitchpredict/db', () => {
  const select = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    let isGrouped = false;
    builder['from'] = () => builder;
    builder['leftJoin'] = () => builder;
    builder['where'] = () => builder;
    builder['groupBy'] = () => {
      isGrouped = true;
      return builder;
    };
    builder['then'] = (resolve: (v: unknown) => void) => {
      resolve(isGrouped ? mockAggregate : mockChampionRows);
    };
    return builder;
  });
  return {
    db: { select },
    schema: {
      users: { id: {}, name: {}, email: {}, role: {} },
      predictions: { userId: {}, id: {}, pointsAwarded: {} },
      championPicks: { userId: {}, teamId: {} },
    },
  };
});

vi.mock('./scoring', () => ({
  CHAMPION_BONUS: 10,
  EXACT: 4,
  DIFFERENCE: 3,
  TENDENCY: 2,
  championTeamId: vi.fn(async () => mockChampionTeamId),
}));

const { rows } = await import('./leaderboard');

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

describe('leaderboard rows', () => {
  beforeEach(() => {
    mockChampionRows = [];
    mockChampionTeamId = null;
  });

  it('orders by total desc, then exact desc, then name asc', async () => {
    mockAggregate = [
      user(1, 'Charlie', { totalPoints: 10, exactCount: 1 }),
      user(2, 'Alice', { totalPoints: 20, exactCount: 2 }),
      user(3, 'Bob', { totalPoints: 20, exactCount: 5 }),
    ];

    const result = await rows();
    expect(result.map((r) => r.user.name)).toEqual(['Bob', 'Alice', 'Charlie']);
    expect(result.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('uses name asc to break a full exact-count tie for display order', async () => {
    mockAggregate = [
      user(1, 'Yana', { totalPoints: 20, exactCount: 2 }),
      user(2, 'Xena', { totalPoints: 20, exactCount: 2 }),
    ];

    const result = await rows();
    expect(result.map((r) => r.user.name)).toEqual(['Xena', 'Yana']);
    expect(result.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('breaks total ties by exact count, then name (rank still by total only)', async () => {
    mockAggregate = [
      user(1, 'Zara', { totalPoints: 15, exactCount: 1 }),
      user(2, 'Anna', { totalPoints: 15, exactCount: 1 }),
    ];

    const result = await rows();
    expect(result.map((r) => r.user.name)).toEqual(['Anna', 'Zara']);
    expect(result.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('assigns standard competition ranking (1,1,3) on equal totals', async () => {
    mockAggregate = [
      user(1, 'Alice', { totalPoints: 20 }),
      user(2, 'Bob', { totalPoints: 20 }),
      user(3, 'Cara', { totalPoints: 5 }),
    ];

    const result = await rows();
    expect(result.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('does not apply the champion bonus before the final has finished', async () => {
    mockAggregate = [user(1, 'Alice', { totalPoints: 12 })];
    mockChampionRows = [{ userId: 1 }];
    mockChampionTeamId = null;

    const result = await rows();
    expect(result[0].totalPoints).toBe(12);
  });

  it('adds the +10 champion bonus only to users who picked the champion', async () => {
    mockAggregate = [
      user(1, 'Alice', { totalPoints: 12 }),
      user(2, 'Bob', { totalPoints: 12 }),
    ];
    mockChampionRows = [{ userId: 1 }]; // only Alice picked the champion
    mockChampionTeamId = 99;

    const result = await rows();
    const byName = Object.fromEntries(result.map((r) => [r.user.name, r]));
    expect(byName['Alice'].totalPoints).toBe(22);
    expect(byName['Bob'].totalPoints).toBe(12);
    expect(result.map((r) => r.user.name)).toEqual(['Alice', 'Bob']);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('exposes the per-user counts and a public user (no passwordHash)', async () => {
    mockAggregate = [
      user(1, 'Alice', {
        totalPoints: 9,
        predictionsCount: 4,
        exactCount: 1,
        diffCount: 1,
        tendencyCount: 1,
      }),
    ];

    const [row] = await rows();
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
