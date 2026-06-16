import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function makeContext(user: AuthUser | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const admin: AuthUser = { id: 1, name: 'A', email: 'a@x.com', role: 'admin' };
  const player: AuthUser = { id: 2, name: 'P', email: 'p@x.com', role: 'player' };

  function guardWith(required: string[] | undefined): RolesGuard {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows when no roles are required', () => {
    expect(guardWith(undefined).canActivate(makeContext(player))).toBe(true);
  });

  it('allows an admin on an admin-only route', () => {
    expect(guardWith(['admin']).canActivate(makeContext(admin))).toBe(true);
  });

  it('denies a player on an admin-only route', () => {
    expect(() => guardWith(['admin']).canActivate(makeContext(player))).toThrow(
      ForbiddenException
    );
  });

  it('denies when there is no authenticated user', () => {
    expect(() =>
      guardWith(['admin']).canActivate(makeContext(undefined))
    ).toThrow(ForbiddenException);
  });

  it('uses the ROLES_KEY metadata key', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    new RolesGuard(reflector).canActivate(makeContext(admin));
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array)
    );
  });
});
