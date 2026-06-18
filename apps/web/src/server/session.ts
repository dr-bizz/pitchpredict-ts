import { auth } from '../auth';
import { ForbiddenError, UnauthorizedError } from './errors';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: 'player' | 'admin';
}

export async function requireUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user?.id) throw new UnauthorizedError();
  return {
    id: Number(s.user.id),
    name: s.user.name ?? '',
    email: s.user.email ?? '',
    role: (s.user.role as 'player' | 'admin') ?? 'player',
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== 'admin') throw new ForbiddenError();
  return u;
}
