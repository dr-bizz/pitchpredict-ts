import { describe, it, expect, vi } from 'vitest';
import { BusinessError } from '../errors';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      if (column?.name === 'userId') return { __userId: value };
      return { __pred: true };
    },
  };
});

interface ChampionPickRow {
  userId: number;
  teamId: number;
  updatedAt?: Date;
}

function makeFakeDb(initial: ChampionPickRow[] = []) {
  const rows: ChampionPickRow[] = [...initial];

  const fakeDb = {
    _rows: rows,
    query: {
      championPicks: {
        findFirst: vi.fn(
          async ({ where }: { where: { __userId?: number } }) =>
            rows.find((r) => r.userId === where.__userId)
        ),
      },
    },
    insert: vi.fn(() => ({
      values: (vals: { userId: number; teamId: number }) => ({
        onConflictDoUpdate: ({ set }: { set: { teamId: number } }) => ({
          returning: async () => {
            const existing = rows.find((r) => r.userId === vals.userId);
            if (existing) {
              existing.teamId = set.teamId;
              return [existing];
            }
            const row: ChampionPickRow = { userId: vals.userId, teamId: vals.teamId };
            rows.push(row);
            return [row];
          },
        }),
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
    championPicks: {
      userId: { name: 'userId' },
      teamId: { name: 'teamId' },
    },
  },
}));

const { upsert, championLocked, forUser } = await import('./champion-picks');

const BEFORE = new Date('2026-06-20T21:59:59Z');
const AT = new Date('2026-06-20T22:00:00Z');
const AFTER = new Date('2026-06-20T22:00:01Z');

describe('championLocked', () => {
  it('is OPEN before the fixed deadline', () => {
    expect(championLocked(BEFORE)).toBe(false);
  });

  it('is LOCKED exactly at the deadline', () => {
    expect(championLocked(AT)).toBe(true);
  });

  it('is LOCKED after the deadline', () => {
    expect(championLocked(AFTER)).toBe(true);
  });
});

describe('upsert (deadline guard)', () => {
  it('inserts a pick when invoked before the deadline', async () => {
    currentFakeDb = makeFakeDb();
    const pick = await upsert(7, { teamId: 99 }, BEFORE);
    expect(pick).toEqual({ userId: 7, teamId: 99 });
    expect(currentFakeDb._rows).toHaveLength(1);
  });

  it('updates an existing pick before the deadline (one row per user)', async () => {
    currentFakeDb = makeFakeDb([{ userId: 7, teamId: 1 }]);
    const pick = await upsert(7, { teamId: 42 }, BEFORE);
    expect(pick.teamId).toBe(42);
    expect(currentFakeDb._rows).toHaveLength(1);
  });

  it('rejects with 422 exactly at the deadline', async () => {
    currentFakeDb = makeFakeDb();
    await expect(upsert(7, { teamId: 99 }, AT)).rejects.toBeInstanceOf(
      BusinessError
    );
    expect(currentFakeDb.insert).not.toHaveBeenCalled();
  });

  it('rejects with 422 after the deadline', async () => {
    currentFakeDb = makeFakeDb();
    await expect(upsert(7, { teamId: 99 }, AFTER)).rejects.toBeInstanceOf(
      BusinessError
    );
    expect(currentFakeDb.insert).not.toHaveBeenCalled();
  });
});

describe('forUser', () => {
  it("returns the caller's pick", async () => {
    currentFakeDb = makeFakeDb([{ userId: 7, teamId: 5 }]);
    expect(await forUser(7)).toEqual({ userId: 7, teamId: 5 });
  });

  it('returns null when the caller has no pick', async () => {
    currentFakeDb = makeFakeDb();
    expect(await forUser(7)).toBeNull();
  });
});
