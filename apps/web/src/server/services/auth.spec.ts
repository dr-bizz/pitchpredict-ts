import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { ConflictError, UnauthorizedError, BusinessError } from '../errors';

const RESET_SECRET = 'test-reset-secret';

interface UserRow {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: 'player' | 'admin';
  updatedAt?: Date;
}

function makeFakeDb(initial: UserRow[] = []) {
  const rows: UserRow[] = [...initial];
  let seq = rows.reduce((m, r) => Math.max(m, r.id), 0);

  let lastWhereId: number | null = null;

  const fakeDb = {
    _rows: rows,
    query: {
      users: {
        findFirst: vi.fn(async ({ where }: { where: { __email?: string } }) => {
          const email = (where as unknown as { __email?: string }).__email;
          return rows.find((r) => r.email === email);
        }),
      },
    },
    insert: vi.fn(() => ({
      values: (vals: Omit<UserRow, 'id'>) => ({
        returning: async () => {
          const row: UserRow = { id: ++seq, ...vals };
          rows.push(row);
          return [
            { id: row.id, name: row.name, email: row.email, role: row.role },
          ];
        },
      }),
    })),
    update: vi.fn(() => ({
      set: (vals: Partial<UserRow>) => ({
        where: (pred: { __id?: number }) => {
          lastWhereId = pred.__id ?? null;
          return {
            returning: async () => {
              const row = rows.find((r) => r.id === lastWhereId);
              if (!row) return [];
              Object.assign(row, vals);
              return [{ id: row.id }];
            },
          };
        },
      }),
    })),
  };
  return fakeDb;
}

// Mock drizzle-orm eq to return tagged objects
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      if (column?.name === 'email') return { __email: value };
      if (column?.name === 'id') return { __id: value };
      return { __email: value };
    },
  };
});

// We'll hold a reference to the current fake db
let currentFakeDb: ReturnType<typeof makeFakeDb>;

vi.mock('@pitchpredict/db', () => ({
  db: new Proxy({} as ReturnType<typeof makeFakeDb>, {
    get(_target, prop) {
      return (currentFakeDb as Record<string | symbol, unknown>)[prop];
    },
  }),
  schema: {
    users: {
      email: { name: 'email' },
      id: { name: 'id' },
    },
  },
}));

// Import after mocks are set up
const { register, login, forgot, reset } = await import('./auth');

describe('auth service', () => {
  beforeAll(() => {
    process.env['AUTH_RESET_SECRET'] = RESET_SECRET;
  });

  describe('register', () => {
    it('hashes the password and returns the public user', async () => {
      currentFakeDb = makeFakeDb();
      const user = await register({
        name: 'Ada',
        email: 'Ada@Example.com',
        password: 'supersecret',
        passwordConfirmation: 'supersecret',
      });

      expect(user).toEqual({
        id: expect.any(Number),
        name: 'Ada',
        email: 'ada@example.com',
        role: 'player',
      });
      const stored = currentFakeDb._rows[0];
      expect(stored.passwordHash).not.toBe('supersecret');
      expect(await bcrypt.compare('supersecret', stored.passwordHash)).toBe(true);
    });

    it('throws 409 on a duplicate email', async () => {
      currentFakeDb = makeFakeDb([
        {
          id: 1,
          name: 'X',
          email: 'dup@example.com',
          passwordHash: 'h',
          role: 'player',
        },
      ]);
      await expect(
        register({
          name: 'Y',
          email: 'DUP@example.com',
          password: 'supersecret',
          passwordConfirmation: 'supersecret',
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('login', () => {
    it('returns the public user on a correct password', async () => {
      const passwordHash = await bcrypt.hash('letmein99', 12);
      currentFakeDb = makeFakeDb([
        {
          id: 7,
          name: 'Grace',
          email: 'grace@example.com',
          passwordHash,
          role: 'admin',
        },
      ]);
      const user = await login({
        email: 'Grace@example.com',
        password: 'letmein99',
      });
      expect(user).toEqual({
        id: 7,
        name: 'Grace',
        email: 'grace@example.com',
        role: 'admin',
      });
    });

    it('throws 401 on a wrong password', async () => {
      const passwordHash = await bcrypt.hash('letmein99', 12);
      currentFakeDb = makeFakeDb([
        {
          id: 7,
          name: 'Grace',
          email: 'grace@example.com',
          passwordHash,
          role: 'player',
        },
      ]);
      await expect(
        login({ email: 'grace@example.com', password: 'wrong' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws 401 for an unknown email', async () => {
      currentFakeDb = makeFakeDb();
      await expect(
        login({ email: 'nobody@example.com', password: 'whatever' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('reset', () => {
    const key = new TextEncoder().encode(RESET_SECRET);

    it('updates the password hash with a valid token', async () => {
      currentFakeDb = makeFakeDb([
        {
          id: 3,
          name: 'Lin',
          email: 'lin@example.com',
          passwordHash: 'old',
          role: 'player',
        },
      ]);
      const token = await new SignJWT({ email: 'lin@example.com' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('3')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(key);

      await reset({
        token,
        password: 'brandnewpw',
        passwordConfirmation: 'brandnewpw',
      });

      const stored = currentFakeDb._rows.find((r) => r.id === 3);
      expect(stored).toBeDefined();
      expect(
        await bcrypt.compare('brandnewpw', stored?.passwordHash ?? '')
      ).toBe(true);
    });

    it('rejects an invalid token with 422', async () => {
      currentFakeDb = makeFakeDb();
      await expect(
        reset({
          token: 'not-a-jwt',
          password: 'brandnewpw',
          passwordConfirmation: 'brandnewpw',
        })
      ).rejects.toBeInstanceOf(BusinessError);
    });

    it('rejects a token signed with the wrong secret with 422', async () => {
      const wrongKey = new TextEncoder().encode('different-secret');
      const token = await new SignJWT({ email: 'lin@example.com' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('3')
        .setExpirationTime('1h')
        .sign(wrongKey);
      currentFakeDb = makeFakeDb();
      await expect(
        reset({
          token,
          password: 'brandnewpw',
          passwordConfirmation: 'brandnewpw',
        })
      ).rejects.toBeInstanceOf(BusinessError);
    });
  });

  describe('forgot', () => {
    it('resolves whether or not the user exists', async () => {
      currentFakeDb = makeFakeDb();
      await expect(
        forgot({ email: 'ghost@example.com' })
      ).resolves.toBeUndefined();
    });
  });
});
