# PitchPredict TS Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is also structured to be executed by a multi-agent Workflow (ultracode), phase by phase.

**Goal:** Recreate the Rails 8 PitchPredict PWA as an Nx monorepo with Next.js (App Router, MUI) + Nest.js + Drizzle + shared Zod contracts + NextAuth v5 (BFF → JWKS) at full feature parity.

**Architecture:** Nx monorepo with two apps (`web` Next.js, `api` Nest.js) and two libs (`contracts` Zod, `db` Drizzle). The browser talks only to the Next BFF proxy, which attaches a NextAuth-issued RS256 JWT and forwards to Nest; Nest verifies via `jwks-rsa`. Business logic (scoring, leaderboard, lock rules) lives in framework-free Nest services. Live leaderboard via TanStack Query polling. Fresh Neon Postgres via Drizzle.

**Tech Stack:** Nx, Next.js 15 (App Router), MUI v6, Nest.js 11, Drizzle ORM, Postgres (Neon), Zod, drizzle-zod, TanStack Query v5, NextAuth v5, passport-jwt, jwks-rsa, jose, bcrypt, Vitest, Playwright, next-pwa.

---

## Reference: Original Rails behavior to preserve

- **Scoring:** 4 exact / 3 goal-difference / 2 tendency / 0; champion bonus +10 derived at read time from the finished final (never persisted).
- **Lock rules:** prediction locked when `kickoffAt <= now OR status !== 'scheduled'`. Champion pick locked once earliest `kickoffAt <= now`.
- **Leaderboard:** two-query aggregate, standard competition ranking ("1224"), secondary sort exact-desc then name-asc.
- **Scores range:** prediction home/away 0–20.
- **Roles:** `player` (default) | `admin`. Admin-only result entry.
- **Teams:** 48, groups A–L, unique 3-uppercase-letter code, flag emoji.
- **Stages:** `group, r32, r16, qf, sf, third_place, final`. **Status:** `scheduled, live, finished`.

---

## Phase 0: Monorepo Scaffold

### Task 0.1: Initialize Nx workspace
**Files:** Create `package.json`, `nx.json`, `tsconfig.base.json`, `.npmrc`, `.editorconfig`, `.prettierrc`, root `eslint.config.mjs`.

- [ ] Create an Nx integrated monorepo (npm package manager) at the repo root (already git-initialized). Use `npx create-nx-workspace@latest . --preset=ts --nx-cloud=skip` semantics, or hand-author the config if the generator fights the existing `.git`/`docs`. Workspace name `pitchpredict`.
- [ ] Add Nx plugins: `@nx/next`, `@nx/nest`, `@nx/js`, `@nx/vite`, `@nx/eslint`, `@nx/playwright`.
- [ ] `tsconfig.base.json` paths: `@pitchpredict/contracts` → `libs/contracts/src/index.ts`, `@pitchpredict/db` → `libs/db/src/index.ts`.
- [ ] Root scripts: `build`, `lint`, `test` mapped to `nx run-many -t <target>`.
- [ ] Commit: `chore: scaffold Nx monorepo`.
- [ ] **Acceptance:** `npx nx report` runs; `nx graph --file=/tmp/g.json` succeeds.

---

## Phase 1: libs/db (Drizzle)

### Task 1.1: Drizzle schema
**Files:** Create `libs/db/src/schema.ts`, `libs/db/src/enums.ts`, `libs/db/src/client.ts`, `libs/db/src/index.ts`, `libs/db/drizzle.config.ts`, `libs/db/project.json`.

- [ ] Define pg enums in `enums.ts`: `roleEnum('role', ['player','admin'])`, `stageEnum('stage', ['group','r32','r16','qf','sf','third_place','final'])`, `statusEnum('status', ['scheduled','live','finished'])`.
- [ ] `schema.ts` tables (camelCase TS, snake_case columns via Drizzle naming or explicit):
  - `users`: `id serial pk`, `name notNull`, `email text notNull unique`, `passwordHash notNull`, `role roleEnum default 'player' notNull`, `createdAt/updatedAt timestamptz default now`.
  - `teams`: `id`, `name notNull`, `code text notNull unique` (3 uppercase enforced in contracts), `groupName text notNull`, `flagEmoji text notNull`.
  - `stadiums`: `id`, `name`, `city`, `country` (all notNull).
  - `fixtures`: `id`, `homeTeamId fk teams`, `awayTeamId fk teams`, `stadiumId fk stadiums`, `kickoffAt timestamptz notNull`, `stage stageEnum default 'group' notNull`, `status statusEnum default 'scheduled' notNull`, `homeScore integer`, `awayScore integer`, timestamps. Index on `kickoffAt`.
  - `predictions`: `id`, `userId fk users onDelete cascade`, `fixtureId fk fixtures onDelete cascade`, `homeScore integer notNull`, `awayScore integer notNull`, `pointsAwarded integer`, timestamps. **Unique (userId, fixtureId)**.
  - `championPicks`: `id`, `userId fk users onDelete cascade unique`, `teamId fk teams`, timestamps.
- [ ] `client.ts`: export `createDb(connectionString)` using `drizzle(postgres(connectionString))` (postgres-js driver), and a singleton `db` reading `DATABASE_URL`. Export `schema` namespace.
- [ ] `drizzle.config.ts`: dialect postgres, schema path, out `libs/db/migrations`, `DATABASE_URL` from env.
- [ ] Add db scripts to `libs/db/project.json`: `db:generate` (drizzle-kit generate), `db:migrate` (drizzle-kit migrate), `db:seed` (tsx seed).
- [ ] Commit: `feat(db): drizzle schema and client`.
- [ ] **Acceptance:** `nx run db:generate` produces a migration SQL file with all tables, enums, unique constraints.

---

## Phase 2: libs/contracts (Zod)

### Task 2.1: Entity + DTO schemas
**Files:** Create `libs/contracts/src/{enums,user,team,stadium,fixture,prediction,champion-pick,leaderboard,dashboard,auth,index}.ts`, `libs/contracts/project.json`, `libs/contracts/vite.config.ts`.

- [ ] `enums.ts`: `zRole`, `zStage`, `zStatus` as `z.enum([...])` matching db enums; export `STAGE_TABS` ordered list `['upcoming','group','r32','r16','qf','sf','third_place','final']`.
- [ ] Entity schemas (use `drizzle-zod` `createSelectSchema`/`createInsertSchema` from `@pitchpredict/db` as the base, then `.extend`/`.refine`):
  - `userSchema` (public: id, name, email, role — **no passwordHash**).
  - `teamSchema`, `stadiumSchema`.
  - `fixtureSchema` + `fixtureWithTeamsSchema` (embeds homeTeam, awayTeam, stadium) + computed `locked: z.boolean()`.
  - `predictionSchema`; `predictionInputSchema = z.object({ homeScore: z.number().int().min(0).max(20), awayScore: z.number().int().min(0).max(20) })`.
  - `championPickInputSchema = z.object({ teamId: z.number().int().positive() })`.
  - `leaderboardRowSchema` = `{ rank, user: userSchema, totalPoints, predictionsCount, exactCount, diffCount, tendencyCount }` (all ints).
  - `dashboardSchema` = `{ topRows: leaderboardRowSchema[], myRow: leaderboardRowSchema.nullable(), fixturesCount, predictedCount, totalPoints, championPick: (teamId, team).nullable(), championLocked, teams: teamSchema[] }`.
  - `auth`: `registerSchema` (name, email, password min 8, passwordConfirmation — refine match), `loginSchema` (email, password), `forgotSchema` (email), `resetSchema` (token, password, passwordConfirmation).
- [ ] Export inferred types via `z.infer` for every schema (e.g. `export type FixtureWithTeams = z.infer<typeof fixtureWithTeamsSchema>`).
- [ ] `index.ts` re-exports everything.
- [ ] Commit: `feat(contracts): shared zod schemas and types`.
- [ ] **Acceptance:** `nx test contracts` (a Vitest sanity test parsing a sample object per schema) passes; `@pitchpredict/contracts` importable from both apps (typecheck).

### Task 2.2: contracts unit tests
**Files:** Create `libs/contracts/src/__tests__/schemas.spec.ts`.
- [ ] Test: `predictionInputSchema` rejects 21 and -1, accepts 0 and 20.
- [ ] Test: `registerSchema` rejects mismatched confirmation.
- [ ] Test: `teamSchema` code refinement rejects `ab`/`ABCD`, accepts `BRA`.
- [ ] Commit.

---

## Phase 3: API Foundation (Nest)

### Task 3.1: Nest app + config + db module
**Files:** Create `apps/api/src/main.ts`, `apps/api/src/app/app.module.ts`, `apps/api/src/config/*`, `apps/api/src/db/db.module.ts` (provides `DRIZZLE` token wrapping `@pitchpredict/db` `db`), `apps/api/src/common/zod-validation.pipe.ts`, `apps/api/project.json`.
- [ ] `main.ts`: bootstrap, global prefix none (BFF maps paths), enable CORS for the web origin, global `ZodValidationPipe`-style usage via a helper, `PORT` from env (default 3334).
- [ ] `ZodValidationPipe`: a factory `zodBody(schema)` / `zodQuery(schema)` used per-route, throwing `BadRequestException` (400) with flattened Zod errors. Lock/business 422s come from services via a dedicated exception.
- [ ] `DbModule` (global): provides Drizzle `db` + `schema`.
- [ ] Add a `HealthController` `GET /health`.
- [ ] Commit: `feat(api): nest bootstrap, db module, validation`.
- [ ] **Acceptance:** `nx serve api` boots; `GET /health` → 200.

---

## Phase 4: API Auth (JWKS verification)

### Task 4.1: JWT strategy + guards
**Files:** Create `apps/api/src/auth/jwt.strategy.ts`, `apps/api/src/auth/jwt-auth.guard.ts`, `apps/api/src/auth/roles.guard.ts`, `apps/api/src/auth/roles.decorator.ts`, `apps/api/src/auth/current-user.decorator.ts`, `apps/api/src/auth/auth.module.ts`.
- [ ] `JwtStrategy` (passport-jwt) with `secretOrKeyProvider` from **`jwks-rsa`** `passportJwtSecret({ jwksUri: process.env.AUTH_JWKS_URI, cache: true, rateLimit: true })`. Options: `algorithms: ['RS256']`, `issuer: process.env.AUTH_JWT_ISSUER`, `audience: process.env.AUTH_JWT_AUDIENCE`, `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()`. `validate(payload)` → `{ id: Number(payload.sub), name, email, role }`.
- [ ] `JwtAuthGuard extends AuthGuard('jwt')`. `RolesGuard` reads `@Roles()` metadata, compares to `user.role`. `@CurrentUser()` param decorator.
- [ ] Commit: `feat(api): jwks-rsa jwt strategy and guards`.
- [ ] **Acceptance:** unit test for `RolesGuard` (allows admin, denies player on admin route).

### Task 4.2: Auth endpoints (register/login/forgot/reset)
**Files:** Create `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`, tests `apps/api/src/auth/auth.service.spec.ts`.
- [ ] `AuthService.register(dto)`: normalize email lowercase, hash with bcrypt (cost 12), insert user (role player), return public user. Throw 409 on duplicate email.
- [ ] `AuthService.login(dto)`: find by email, `bcrypt.compare`, return public user or throw 401.
- [ ] `AuthService.forgot(email)`: if user exists, sign an expiring reset token (jose HS256 with `AUTH_RESET_SECRET`, 1h exp); log/stub email. Always return 200.
- [ ] `AuthService.reset(dto)`: verify token, update passwordHash. 422 on invalid/expired.
- [ ] Controller: `POST /auth/register|login|forgot|reset` (all public — no guard), Zod-validated.
- [ ] Tests: register hashes + rejects dup; login verifies password; reset rejects bad token.
- [ ] Commit: `feat(api): auth endpoints`.

---

## Phase 5: API Domain Services (the correctness core — TDD)

### Task 5.1: Lock/tournament helpers
**Files:** Create `apps/api/src/domain/fixture-rules.ts`, test `apps/api/src/domain/fixture-rules.spec.ts`.
- [ ] `isFixtureLocked(f: { kickoffAt: Date; status: string }, now = new Date())` → `f.kickoffAt <= now || f.status !== 'scheduled'`.
- [ ] `tournamentStarted(earliestKickoff: Date | null, now = new Date())` → `!!earliestKickoff && earliestKickoff <= now`.
- [ ] Tests cover: scheduled future = open; past kickoff = locked; finished/live before kickoff = locked.
- [ ] Commit.

### Task 5.2: ScoringService (TDD)
**Files:** Create `apps/api/src/scoring/scoring.service.ts`, test `apps/api/src/scoring/scoring.service.spec.ts`.
- [ ] **Write failing tests first** for `pointsFor`:
  - exact (2-1 vs 2-1) → 4; goal diff (3-2 vs 2-1) → 3; tendency (1-0 vs 3-1) → 2; draw-as-draw wrong score (1-1 vs 2-2) → 3 (same diff 0); wrong (0-0 vs 1-0) → 0.
- [ ] Implement `pointsFor` per the reference algorithm.
- [ ] Constants `EXACT=4, DIFFERENCE=3, TENDENCY=2, CHAMPION_BONUS=10`.
- [ ] `scoreFixture(fixtureId)`: load fixture; throw if not `finished`; in a Drizzle transaction, recompute `pointsAwarded` for every prediction of the fixture (idempotent). 
- [ ] `championTeamId()`: load finished final; null if none or level; else higher-score team id.
- [ ] Tests for `scoreFixture` idempotency and `championTeamId` (null when level, correct winner).
- [ ] Commit: `feat(api): scoring service`.

### Task 5.3: LeaderboardService (TDD)
**Files:** Create `apps/api/src/leaderboard/leaderboard.service.ts`, test `apps/api/src/leaderboard/leaderboard.service.spec.ts`.
- [ ] `rows()`: SQL aggregate over `users left join predictions` grouping by user: `totalPoints = COALESCE(SUM(pointsAwarded),0)`, `predictionsCount = COUNT(predictions.id)`, `exact/diff/tendency = SUM(CASE WHEN pointsAwarded = N ...)`. Then add champion bonus to users whose `championPicks.teamId === championTeamId()`.
- [ ] Sort by `[-total, -exactCount, name]`; assign **standard competition ranking** (equal totals share rank, next rank skips).
- [ ] Tests (against a seeded test db or in-memory rows): ranking ties produce 1,1,3; champion bonus applied only after final finished.
- [ ] Commit: `feat(api): leaderboard service`.

---

## Phase 6: API Feature Modules

### Task 6.1: Fixtures + Predictions
**Files:** `apps/api/src/fixtures/{fixtures.controller,fixtures.service,fixtures.module}.ts`, `apps/api/src/predictions/{predictions.controller,predictions.service,predictions.module}.ts`.
- [ ] `GET /fixtures?stage=` (auth): if `stage` absent/`upcoming` → future scheduled fixtures asc, grouped by date; else fixtures for stage asc (group stage additionally grouped by `homeTeam.groupName`). Embed home/away team + stadium + `locked`. Include caller's predictions map. Response shape per `contracts`.
- [ ] `PUT /fixtures/:id/prediction` (auth): upsert by (user, fixture). Load fixture; if `isFixtureLocked` → 422 "Predictions are locked for this match". Validate body with `predictionInputSchema`. Upsert via `onConflictDoUpdate` (userId,fixtureId). Return prediction.
- [ ] Commit: `feat(api): fixtures and predictions`.

### Task 6.2: Champion picks + Leaderboard + Dashboard
**Files:** `apps/api/src/champion-picks/*`, `apps/api/src/leaderboard/leaderboard.controller.ts`, `apps/api/src/dashboard/*`.
- [ ] `GET /champion-pick` (auth) → current pick or null. `PUT /champion-pick` (auth): if `tournamentStarted()` → 422 "Champion picks are locked once the tournament has started"; else upsert by userId. Validate `championPickInputSchema`.
- [ ] `GET /leaderboard` (auth) → `leaderboardRowSchema[]` from `LeaderboardService.rows()`.
- [ ] `GET /dashboard` (auth): top-5 rows, my row, `fixturesCount` (total), `predictedCount` (my predictions), `totalPoints` (my row or 0), champion pick + team, `championLocked = tournamentStarted()`, `teams` (ordered by name) when not locked.
- [ ] Commit: `feat(api): champion picks, leaderboard, dashboard`.

### Task 6.3: Admin fixtures
**Files:** `apps/api/src/admin/{admin-fixtures.controller,admin-fixtures.service,admin.module}.ts`.
- [ ] `GET /admin/fixtures?stage=&status=` (auth + `@Roles('admin')`): filtered list ordered by status then kickoff.
- [ ] `PATCH /admin/fixtures/:id` (auth + admin): validate `{homeScore,awayScore}` (int >= 0); set `status='finished'`; persist; then call `ScoringService.scoreFixture(id)` synchronously. Return updated fixture.
- [ ] e2e test: admin scores → predictions get points; non-admin gets 403.
- [ ] Commit: `feat(api): admin fixtures + synchronous rescore`.

---

## Phase 7: Web Foundation (Next + MUI + NextAuth + BFF)

### Task 7.1: Next app + MUI theme + providers
**Files:** `apps/web/app/layout.tsx`, `apps/web/src/theme.ts`, `apps/web/src/providers.tsx`, `apps/web/app/globals.css`, `apps/web/project.json`, `apps/web/next.config.js`.
- [ ] MUI theme (`createTheme`): palette primary `#0A7B4B` (dark `#075C38`), secondary `#E8B53D`, background default `#F7F8F6`, text primary `#111418`; shape borderRadius 12; component overrides for Card (rounded 16, soft shadow `0 1px 2px rgb(17 20 24 / 0.04), 0 6px 24px -8px rgb(17 20 24 / 0.12)`), Button (no uppercase). Use `AppRouterCacheProvider` + `ThemeProvider` + `CssBaseline`.
- [ ] `providers.tsx`: TanStack `QueryClientProvider` (defaults: `staleTime` 30s, `refetchOnWindowFocus` true) + `SessionProvider`.
- [ ] Commit: `feat(web): next app, mui theme, providers`.

### Task 7.2: NextAuth v5 RS256 + JWKS endpoint
**Files:** `apps/web/src/auth.ts` (NextAuth config), `apps/web/app/api/auth/[...nextauth]/route.ts`, `apps/web/app/api/auth/jwks.json/route.ts`, `apps/web/src/server/jwt.ts`, `apps/web/middleware.ts`.
- [ ] `auth.ts`: NextAuth v5 `Credentials` provider. `authorize` POSTs to Nest `/auth/login`; on success returns user `{id,name,email,role}`. `session: { strategy: 'jwt' }`. `callbacks.jwt` copies `id`/`role` into the token; `callbacks.session` exposes them.
- [ ] `jwt.ts`: load RS256 keypair from env (`AUTH_JWT_PRIVATE_KEY` PEM, `AUTH_JWT_PUBLIC_KEY` PEM). `signApiToken(session)` → jose `SignJWT` RS256 with `sub`, `name`, `email`, `role`, `iss`=`AUTH_JWT_ISSUER`, `aud`=`AUTH_JWT_AUDIENCE`, `kid`, exp 1h. `getJwks()` → public JWK with matching `kid` via jose `exportJWK`.
- [ ] `jwks.json/route.ts`: `GET` returns `{ keys: [jwk] }` (kid, use sig, alg RS256). This is `AUTH_JWKS_URI` for the API.
- [ ] `middleware.ts`: protect app routes (redirect unauthenticated to `/login`), except auth pages + jwks + nextauth.
- [ ] Commit: `feat(web): nextauth rs256 + jwks endpoint`.
- [ ] **Acceptance:** `GET /api/auth/jwks.json` returns a valid JWK; a token signed by `signApiToken` verifies against it (unit test with jose).

### Task 7.3: BFF proxy
**Files:** `apps/web/app/api/proxy/[...path]/route.ts`, `apps/web/src/server/api-proxy.ts`.
- [ ] Catch-all route handler (GET/POST/PUT/PATCH/DELETE): read NextAuth session server-side; if present, `signApiToken` and attach `Authorization: Bearer`. Forward method, path (`/api/proxy/foo` → `${API_URL}/foo`), query, and body to Nest. Stream/return JSON + status (pass through 4xx/5xx incl. 422 bodies).
- [ ] Commit: `feat(web): BFF proxy to nest`.
- [ ] **Acceptance:** with a logged-in session, `GET /api/proxy/health` returns the Nest health payload.

---

## Phase 8: Web Data Layer

### Task 8.1: API client + TanStack Query hooks
**Files:** `apps/web/src/api/client.ts`, `apps/web/src/api/hooks/{useFixtures,usePrediction,useChampionPick,useLeaderboard,useDashboard,useAdminFixtures}.ts`.
- [ ] `client.ts`: `apiFetch(path, opts)` → `fetch('/api/proxy'+path)`, parse JSON, throw a typed `ApiError` (with status + parsed message) on non-2xx. Validate responses with the relevant `contracts` schema (`.parse`).
- [ ] Query hooks return typed data. `useLeaderboard` sets `refetchInterval: 15000`. Mutations: `usePrediction().mutate` (PUT) invalidates `['fixtures']` + `['dashboard']`; champion pick invalidates `['dashboard']`; admin score invalidates `['leaderboard','dashboard','adminFixtures']`.
- [ ] Commit: `feat(web): tanstack query hooks`.

---

## Phase 9: Web Screens & Components

### Task 9.1: Shared components
**Files:** `apps/web/src/components/{ScoreStepper,FixtureCard,BottomNav,AppHeader,LeaderboardTable,Podium}.tsx`.
- [ ] `ScoreStepper`: MUI, chevron-up button / number input (0–20, tabular-nums) / chevron-down button; controlled value + onChange; disabled state. Replaces Stimulus `stepper_controller`.
- [ ] `FixtureCard`: three states — **open** (two `ScoreStepper`s + Save/Update button, shows team flags/names, venue + kickoff, calls `usePrediction`), **locked** (disabled inputs + lock note, shows saved pick if any), **finished** (real result in pitch-green, your pick + `+N pts` badge or "No prediction"). Mirror the Rails `_fixture_card` layout and badges.
- [ ] `BottomNav` (MUI BottomNavigation): Dashboard / Predictions / Leaderboard (+ Admin when role admin).
- [ ] `LeaderboardTable` + `Podium`: top-3 podium, full table, highlight current user's row.
- [ ] Commit: `feat(web): shared components`.

### Task 9.2: Auth pages
**Files:** `apps/web/app/(auth)/login/page.tsx`, `.../signup/page.tsx`, `.../forgot/page.tsx`, `.../reset/page.tsx`.
- [ ] Login: MUI form → `signIn('credentials')`; error display. Signup: form → proxy `POST /auth/register` then `signIn`. Forgot/reset: proxy calls. All validate with `contracts` auth schemas client-side.
- [ ] Commit: `feat(web): auth pages`.

### Task 9.3: Dashboard, Predictions, Leaderboard, Admin pages
**Files:** `apps/web/app/(app)/page.tsx` (dashboard), `apps/web/app/(app)/predictions/page.tsx`, `apps/web/app/(app)/leaderboard/page.tsx`, `apps/web/app/(app)/admin/page.tsx`, plus `(app)/layout.tsx` (header + bottom nav).
- [ ] Dashboard: `useDashboard` → rank/points/counts cards, champion pick card (Select of teams when not locked → `useChampionPick` mutate; locked state shows the pick), top-5 mini leaderboard.
- [ ] Predictions: stage tabs (`STAGE_TABS`); upcoming grouped by date, group stage grouped by group; render `FixtureCard` grid via `useFixtures(stage)`.
- [ ] Leaderboard: `useLeaderboard` (polling) → `Podium` + `LeaderboardTable`.
- [ ] Admin: guarded by role; stage/status filters; result-entry form per fixture → admin score mutation; success/error feedback.
- [ ] Commit: `feat(web): app pages`.

---

## Phase 10: PWA

### Task 10.1: Manifest, service worker, icons
**Files:** `apps/web/public/manifest.webmanifest`, `apps/web/public/offline.html`, `apps/web/public/icon.svg` + `icon.png` (ported from Rails `public/`), `apps/web/app/layout.tsx` (link manifest + theme-color meta), `next.config.js` (next-pwa or App Router SW).
- [ ] Manifest: name PitchPredict, short_name, theme_color `#0A7B4B`, background `#F7F8F6`, display standalone, orientation portrait, icons, shortcuts (Predictions, Leaderboard).
- [ ] Service worker via `next-pwa` (or a custom SW): precache app shell, runtime cache for proxy GETs (network-first), offline fallback page.
- [ ] Commit: `feat(web): PWA manifest + service worker`.
- [ ] **Acceptance:** Lighthouse PWA installability passes in a production build.

---

## Phase 11: Seed

### Task 11.1: Seed script
**Files:** `libs/db/src/seed.ts`, `libs/db/src/seed-data/{teams,stadiums,fixtures}.ts`.
- [ ] Port `db/seeds.rb`: destructive rebuild (truncate all), insert 48 teams (groups A–L, codes, flags), host stadiums, real 2026 group-stage fixtures (port the data tables from the Rails seed). Knockout pairings illustrative/placeholder.
- [ ] Users: admin (`admin@pitchpredict.app`/`worldcup2026`, role admin), `demo@pitchpredict.app`, `player1..12@pitchpredict.app` (same password, bcrypt-hashed).
- [ ] **Two-phase** to satisfy lock rules: phase 1 create fixtures with future kickoffs, seed predictions + champion picks; phase 2 backdate ~half the group stage, set scores + `finished`, run `ScoringService.scoreFixture`.
- [ ] Commit: `feat(db): seed demo world`.
- [ ] **Acceptance:** `nx run db:seed` populates the DB; leaderboard shows non-zero points; admin/demo logins work.

---

## Phase 12: Integration tests & verification

### Task 12.1: API e2e
**Files:** `apps/api-e2e/src/**`.
- [ ] supertest flows: signup→login (token), predict open fixture (200), predict locked fixture (422), champion pick before/after start, admin score → leaderboard reflects points + bonus, non-admin admin route 403.
- [ ] Commit.

### Task 12.2: Web e2e (Playwright)
**Files:** `apps/web-e2e/src/**`.
- [ ] Flow: seed → login as demo → predict an open fixture → see it saved → leaderboard renders.
- [ ] Commit.

### Task 12.3: Final verification
- [ ] `nx run-many -t lint test build` all green.
- [ ] `README.md` with setup (`.env` keys: `DATABASE_URL`, `API_URL`, `AUTH_URL`, `AUTH_SECRET`, `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWKS_URI`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, `AUTH_RESET_SECRET`), run, seed, test instructions.
- [ ] `.env.example` with all keys.
- [ ] Commit: `docs: README + env example`.

---

## Self-Review notes

- **Spec coverage:** auth (P4,7), data layer (P1), contracts (P2), scoring/leaderboard (P5), all endpoints (P6), MUI theme + screens (P7,9), PWA (P10), seed (P11), tests (P5,12). ✓
- **Type consistency:** `pointsFor`/`scoreFixture`/`championTeamId` names consistent P5↔P6↔P11; `signApiToken`/`getJwks`/`AUTH_JWKS_URI` consistent P7↔P4; contract schema names consistent P2↔P8.
- **Env keys** are the single source in Task 12.3; same names used in P4/P7.
