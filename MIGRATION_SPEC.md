# Migration Spec — Collapse NestJS into Next.js (single deployable)

**Goal:** Remove `apps/api` (NestJS) entirely. Move all server logic into the Next.js
web app (`apps/web`) so the project deploys as ONE service. Keep `libs/db` and
`libs/contracts` as-is. Branch: `refactor/collapse-nest-into-next`.

## Target structure (apps/web)

```
apps/web/src/server/
  errors.ts          # AppError + subclasses + toErrorResponse()
  validation.ts      # parseBody(schema, req), parseQuery(schema, searchParams)
  session.ts         # requireUser(), requireAdmin()  (reads NextAuth session)
  route.ts           # route(handler) wrapper -> catches AppError -> JSON Response
  domain/
    fixture-rules.ts          # isFixtureLocked, tournamentStarted
    fixture-rules.spec.ts
  services/
    auth.ts          # register, login, forgot, reset
    auth.spec.ts
    scoring.ts       # pointsFor, scoreFixture, championTeamId + constants
    scoring.spec.ts
    leaderboard.ts   # rows()
    leaderboard.spec.ts
    dashboard.ts     # forUser(userId)
    fixtures.ts      # list(stage, userId)
    predictions.ts   # upsert(userId, fixtureId, input)
    champion-picks.ts# forUser(userId), upsert(userId, input)
    admin-fixtures.ts# list(stage?, status?), enterResult(fixtureId, input)
apps/web/src/auth.config.ts   # EDGE-SAFE NextAuth config (no db) — used by middleware
apps/web/src/auth.ts          # NODE NextAuth instance (Credentials provider -> login service)
apps/web/app/api/...          # route handlers (see route map)
```

## Service porting rules

- Each Nest `@Injectable` service becomes a **module of plain async functions**.
- Replace constructor-injected `this.db` with the shared singleton:
  `import { db, schema } from '@pitchpredict/db';` then use `db` directly.
- Keep ALL business logic byte-for-byte identical (same queries, ordering, locks,
  scoring constants, ranking). This is a lift-and-shift, not a rewrite.
- Replace Nest exceptions with `AppError` subclasses (see Errors). Mapping:
  - `ConflictException`      -> `ConflictError`     (409)
  - `UnauthorizedException`  -> `UnauthorizedError` (401)
  - `BusinessException`      -> `BusinessError`     (422)
  - `NotFoundException`      -> `NotFoundError`     (404)
- `Logger` -> `console` (e.g. `console.log`/`console.warn`).
- Port the matching `*.spec.ts` for any service that has one today (auth, scoring,
  leaderboard, roles->n/a, fixture-rules). Tests must pass with vitest.

## Errors (src/server/errors.ts)

```ts
export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message); this.name = 'AppError';
  }
}
export class ValidationError  extends AppError { constructor(d:unknown){ super(400,'Validation failed',d);} }
export class UnauthorizedError extends AppError { constructor(m='Unauthorized'){ super(401,m);} }
export class ForbiddenError    extends AppError { constructor(m='Forbidden'){ super(403,m);} }
export class NotFoundError     extends AppError { constructor(m='Not found'){ super(404,m);} }
export class ConflictError     extends AppError { constructor(m='Conflict'){ super(409,m);} }
export class BusinessError     extends AppError { constructor(m:string){ super(422,m);} }
```

`toErrorResponse(err)` -> `Response.json({ statusCode, message, error, details? }, { status })`.
The body shape must keep a top-level `message` string (the browser client reads
`body.message`). For ValidationError include `details` = flattened zod error.

## route wrapper (src/server/route.ts)

```ts
export async function route(fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (err) {
    if (err instanceof AppError) return toErrorResponse(err);
    console.error(err);
    return Response.json({ statusCode:500, message:'Internal server error', error:'Internal Server Error' }, { status:500 });
  }
}
```

## validation (src/server/validation.ts)

- `parseBody(schema, req)`: `await req.json()` (tolerate empty), `schema.safeParse`,
  on failure throw `new ValidationError(result.error.flatten())`.
- `parseQuery(schema, searchParams)`: build a plain object from `URLSearchParams`,
  `safeParse`, throw `ValidationError` on failure.

## session (src/server/session.ts)

```ts
import { auth } from '../auth';
export interface SessionUser { id: number; name: string; email: string; role: 'player'|'admin'; }
export async function requireUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user?.id) throw new UnauthorizedError();
  return { id: Number(s.user.id), name: s.user.name ?? '', email: s.user.email ?? '', role: (s.user.role as any) ?? 'player' };
}
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== 'admin') throw new ForbiddenError();
  return u;
}
```

## Route handler pattern (EVERY route follows this)

```ts
// apps/web/app/api/dashboard/route.ts
import type { NextRequest } from 'next/server';
import { route } from '../../../src/server/route';
import { requireUser } from '../../../src/server/session';
import { forUser } from '../../../src/server/services/dashboard';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    const user = await requireUser();
    return Response.json(await forUser(user.id));
  });
}
```

- Dates serialize to ISO via `Response.json` automatically (matches old Nest behavior;
  the browser client revives `kickoffAt`/`createdAt`/`updatedAt`).
- All data routes are Node runtime (default). Do NOT add `export const runtime='edge'`.

## Route map (old Nest path -> new Next file)

| Method | New path                      | File                                                    | Auth  | Service call |
|--------|-------------------------------|---------------------------------------------------------|-------|--------------|
| POST   | /api/auth/register            | app/api/auth/register/route.ts                          | none  | register(body) |
| POST   | /api/auth/forgot              | app/api/auth/forgot/route.ts                            | none  | forgot(body) -> {ok:true} |
| POST   | /api/auth/reset               | app/api/auth/reset/route.ts                             | none  | reset(body) -> {ok:true} |
| GET    | /api/health                   | app/api/health/route.ts                                 | none  | {status:'ok',timestamp} |
| GET    | /api/leaderboard              | app/api/leaderboard/route.ts                            | user  | rows() |
| GET    | /api/dashboard                | app/api/dashboard/route.ts                              | user  | forUser(id) |
| GET    | /api/fixtures                 | app/api/fixtures/route.ts (?stage=)                     | user  | list(stage, id) |
| PUT    | /api/fixtures/[id]/prediction | app/api/fixtures/[id]/prediction/route.ts               | user  | predictions.upsert(id,fixtureId,body) |
| GET    | /api/champion-pick            | app/api/champion-pick/route.ts                          | user  | championPicks.forUser(id) |
| PUT    | /api/champion-pick            | app/api/champion-pick/route.ts                          | user  | championPicks.upsert(id,body) |
| GET    | /api/admin/fixtures           | app/api/admin/fixtures/route.ts (?stage=&status=)       | admin | adminFixtures.list(stage,status) |
| PATCH  | /api/admin/fixtures/[id]      | app/api/admin/fixtures/[id]/route.ts                    | admin | adminFixtures.enterResult(id,body) |

NOTE: static segments (`register`,`forgot`,`reset`) under `/api/auth` win over the
NextAuth `[...nextauth]` catch-all, so they coexist fine. Keep `/api/auth/[...nextauth]`.
DELETE `/api/auth/jwks.json` and `/api/proxy/[...path]`.

Login is NOT a REST route — it stays inside NextAuth `signIn('credentials')`.

## NextAuth split config (CRITICAL — middleware runs on Edge)

`middleware.ts` imports the auth instance and runs on Edge, so the module the
middleware imports must NOT pull in Drizzle/postgres/bcrypt.

- `src/auth.config.ts` (edge-safe): export a `NextAuthConfig` with `session:{strategy:'jwt'}`,
  `pages:{signIn:'/login'}`, the `jwt` + `session` callbacks (copy from current auth.ts),
  and `providers: []`. NO db imports.
- `src/auth.ts` (node): `import authConfig from './auth.config'`; build
  `NextAuth({ ...authConfig, providers:[ Credentials({... authorize}) ] })`. The
  `authorize` calls the ported `login()` service directly (db + bcrypt) instead of
  fetching `/auth/login`. Returns `{id:String(user.id), name, email, role}` or null.
  Export `auth, handlers, signIn, signOut`.
- `middleware.ts`: change to `import NextAuth from 'next-auth'; import authConfig from './src/auth.config'; export default NextAuth(authConfig).auth(<existing callback>)`.
  Keep the existing redirect logic + matcher. This keeps db/bcrypt OUT of Edge.

## Client change

- `apps/web/src/api/client.ts`: change `PROXY_BASE = '/api/proxy'` -> `'/api'`.
- `apps/web/app/(auth)/signup/page.tsx`: `'/api/proxy/auth/register'` -> `'/api/auth/register'`.
- `apps/web/app/(auth)/forgot/page.tsx`: `'/api/proxy/auth/forgot'` -> `'/api/auth/forgot'`.
- `apps/web/app/(auth)/reset/page.tsx`:  `'/api/proxy/auth/reset'`  -> `'/api/auth/reset'`.

## Deletions / cleanup

- Delete dirs: `apps/api`, `apps/api-e2e`.
- Delete files: `apps/web/src/server/api-proxy.ts`, `apps/web/src/server/jwt.ts`,
  `apps/web/src/server/__tests__/jwt.spec.ts`, `apps/web/app/api/proxy/`,
  `apps/web/app/api/auth/jwks.json/`.
- `package.json`: remove Nest deps (`@nestjs/*`, `passport`, `passport-jwt`,
  `@nestjs/passport`, `jwks-rsa`, `@nx/nest`, `@nx/node`, `@nestjs/schematics`,
  `@nestjs/testing`). KEEP `jose` (still used? only jwt.ts used it for signing +
  auth.service forgot/reset HS256 — auth.service still needs jose) and `bcryptjs`.
- Update `.env.example` and `README.md`: remove `API_URL`, `AUTH_JWKS_URI`,
  `AUTH_JWT_*`, `WEB_ORIGIN` (CORS gone). Keep `DATABASE_URL`, `AUTH_URL`,
  `AUTH_SECRET`, `AUTH_RESET_SECRET`.
- Update root tsconfig project references and any nx config that references api.
- Delete this file (`MIGRATION_SPEC.md`) at the end.

## Verification gates

- `npx nx typecheck web` clean.
- `npx nx test web` (vitest) green incl. ported specs.
- `npx nx build web` succeeds.
- No remaining references to `/api/proxy`, `API_URL`, `signApiToken`, `jwks`, `@nestjs`.
</content>
