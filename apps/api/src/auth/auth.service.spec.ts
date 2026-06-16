import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { BusinessException } from '../common/business.exception';
import { AuthService } from './auth.service';
import type { DrizzleDb } from '../db/db.module';

const RESET_SECRET = 'test-reset-secret';

interface UserRow {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: 'player' | 'admin';
}

/**
 * Minimal in-memory stand-in for the bits of the Drizzle API that AuthService
 * uses: query.users.findFirst, insert().values().returning(),
 * update().set().where().returning(). The `where` clause is a recorded predicate
 * we re-evaluate against the row set.
 */
function makeFakeDb(initial: UserRow[] = []) {
  const rows: UserRow[] = [...initial];
  let seq = rows.reduce((m, r) => Math.max(m, r.id), 0);

  let lastWhereId: number | null = null;

  const db = {
    _rows: rows,
    query: {
      users: {
        findFirst: jest.fn(async ({ where }: { where: { email: string } }) => {
          // The service builds eq(users.email, email); we capture the value via a
          // tagged object below. Fall back to scanning by captured email.
          const email = (where as unknown as { __email?: string }).__email;
          return rows.find((r) => r.email === email);
        }),
      },
    },
    insert: jest.fn(() => ({
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
    update: jest.fn(() => ({
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
  return db as unknown as DrizzleDb & { _rows: UserRow[] };
}

// Make eq() build a predicate object the fake db can read, regardless of which
// column it's called with. We intercept by patching the where argument shape in
// the service via these helpers is not possible; instead the fake findFirst
// reads `__email`. To bridge, we override eq through the schema's column name.
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return {
    ...actual,
    eq: (column: { name?: string }, value: unknown) => {
      // column is the Drizzle column; users.email has name 'email', id 'id'.
      if (column?.name === 'email') return { __email: value };
      if (column?.name === 'id') return { __id: value };
      return { __email: value };
    },
  };
});

describe('AuthService', () => {
  beforeAll(() => {
    process.env['AUTH_RESET_SECRET'] = RESET_SECRET;
  });

  describe('register', () => {
    it('hashes the password and returns the public user', async () => {
      const db = makeFakeDb();
      const service = new AuthService(db);
      const user = await service.register({
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
      const stored = db._rows[0];
      expect(stored.passwordHash).not.toBe('supersecret');
      expect(await bcrypt.compare('supersecret', stored.passwordHash)).toBe(
        true
      );
    });

    it('throws 409 on a duplicate email', async () => {
      const db = makeFakeDb([
        {
          id: 1,
          name: 'X',
          email: 'dup@example.com',
          passwordHash: 'h',
          role: 'player',
        },
      ]);
      const service = new AuthService(db);
      await expect(
        service.register({
          name: 'Y',
          email: 'DUP@example.com',
          password: 'supersecret',
          passwordConfirmation: 'supersecret',
        })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns the public user on a correct password', async () => {
      const passwordHash = await bcrypt.hash('letmein99', 12);
      const db = makeFakeDb([
        {
          id: 7,
          name: 'Grace',
          email: 'grace@example.com',
          passwordHash,
          role: 'admin',
        },
      ]);
      const service = new AuthService(db);
      const user = await service.login({
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
      const db = makeFakeDb([
        {
          id: 7,
          name: 'Grace',
          email: 'grace@example.com',
          passwordHash,
          role: 'player',
        },
      ]);
      const service = new AuthService(db);
      await expect(
        service.login({ email: 'grace@example.com', password: 'wrong' })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 for an unknown email', async () => {
      const service = new AuthService(makeFakeDb());
      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('reset', () => {
    const key = new TextEncoder().encode(RESET_SECRET);

    it('updates the password hash with a valid token', async () => {
      const db = makeFakeDb([
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

      const service = new AuthService(db);
      await service.reset({
        token,
        password: 'brandnewpw',
        passwordConfirmation: 'brandnewpw',
      });

      const stored = db._rows.find((r) => r.id === 3);
      expect(stored).toBeDefined();
      expect(
        await bcrypt.compare('brandnewpw', stored?.passwordHash ?? '')
      ).toBe(true);
    });

    it('rejects an invalid token with 422', async () => {
      const service = new AuthService(makeFakeDb());
      await expect(
        service.reset({
          token: 'not-a-jwt',
          password: 'brandnewpw',
          passwordConfirmation: 'brandnewpw',
        })
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('rejects a token signed with the wrong secret with 422', async () => {
      const wrongKey = new TextEncoder().encode('different-secret');
      const token = await new SignJWT({ email: 'lin@example.com' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('3')
        .setExpirationTime('1h')
        .sign(wrongKey);
      const service = new AuthService(makeFakeDb());
      await expect(
        service.reset({
          token,
          password: 'brandnewpw',
          passwordConfirmation: 'brandnewpw',
        })
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe('forgot', () => {
    it('resolves whether or not the user exists', async () => {
      const service = new AuthService(makeFakeDb());
      await expect(
        service.forgot({ email: 'ghost@example.com' })
      ).resolves.toBeUndefined();
    });
  });
});
