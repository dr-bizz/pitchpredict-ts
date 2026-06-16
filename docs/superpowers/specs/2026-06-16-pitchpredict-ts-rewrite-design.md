# PitchPredict TS — Design Spec

**Date:** 2026-06-16
**Status:** Approved
**Goal:** Recreate the Rails 8 PWA `predictions/pitchpredict` with a modern TypeScript stack, at full feature parity.

## Overview

PitchPredict is a World Cup 2026 score-prediction game. Players predict the
scoreline of every match before kickoff, pick a tournament champion, and climb a
live-updating leaderboard as admins enter real results.

Core mechanics (ported verbatim from the Rails app):

- **Predict** — enter a scoreline (0–20 each side) for any fixture until it kicks
  off. Predictions lock automatically at kickoff, or earlier the moment a result
  is recorded (fixture leaves `scheduled`).
- **Champion pick** — choose the team you think wins the trophy before the
  tournament's first match. Correct picks earn a **+10 bonus** once the final is
  decided. The bonus is **never persisted** — it is derived at read time.
- **Score** — when an admin records a result the fixture's predictions are
  rescored immediately (idempotent), and the leaderboard reflects it.

### Scoring rules (`ScoringService`)

| Outcome | Points |
| --- | --- |
| Exact score | **4** |
| Correct goal difference (not exact) | **3** |
| Correct tendency only (right winner, or a draw) | **2** |
| Anything else | **0** |
| Champion pick is the winner | **+10** (read-time bonus) |

`pointsFor(predictedHome, predictedAway, actualHome, actualAway)`:
1. exact → 4
2. `predictedHome - predictedAway === actualHome - actualAway` → 3
3. `sign(predictedHome - predictedAway) === sign(actualHome - actualAway)` → 2
4. else → 0

`championTeamId()` — the winning team id of the finished final, or null if the
final hasn't finished or ended level (assumption: a final cannot end level; the
admin records the post-ET/penalties deciding score).

### Leaderboard (`LeaderboardService`)

Two queries total (one grouped aggregate over users+predictions, one pluck for
champion picks). Returns rows ordered by total points (champion bonus included
once the final is finished) with **standard competition ranking** ("1224") on
equal points. Secondary display order: exact count desc, then name asc (does not
affect rank). Each row: `rank, user, totalPoints, predictionsCount, exactCount,
diffCount, tendencyCount`.

## Tech Stack

- **Build/tooling:** Nx monorepo
- **Frontend:** Next.js (App Router) + MUI
- **Backend:** Nest.js
- **Validation:** Zod, shared contracts between frontend and backend
- **Data fetching:** TanStack Query
- **Auth:** NextAuth v5 (Credentials), BFF proxy to Nest, JwtStrategy using `jwks-rsa`
- **ORM/DB:** Drizzle ORM on a fresh Neon Postgres database
- **Mobile:** PWA-first
- **Live updates:** TanStack Query polling/invalidation (no WebSockets)
- **Rescoring:** synchronous, in-request (no job queue)

## Monorepo Layout

```
predictions/pitchpredictTS/
├── apps/
│   ├── web/            # Next.js App Router (MUI) — PWA + BFF proxy + NextAuth
│   └── api/            # Nest.js — REST API, scoring, leaderboard
├── libs/
│   ├── contracts/      # Shared Zod schemas + inferred TS types
│   └── db/             # Drizzle schema, client, migrations, seed
├── nx.json
├── package.json
├── tsconfig.base.json
```

`libs/contracts` is imported by both `web` and `api`. `drizzle-zod` derives base
schemas from `libs/db`; `contracts` refines them (e.g. score 0–20) and defines
request/response DTOs. The API validates input with these schemas (Zod pipe/
validation), the web app validates forms and consumes typed responses.

## Auth Flow (NextAuth v5 → BFF → Nest/JWKS)

1. **NextAuth v5** in `apps/web`, **Credentials provider**.
   - Login → calls Nest `POST /auth/login`; Nest verifies bcrypt password against
     `users`, returns the user (id, name, email, role).
   - Signup → Nest `POST /auth/register`.
2. NextAuth uses the **`jwt` session strategy**, signing the session token with
   **RS256** using a private key held only by the web server (env:
   `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY`). The JWT carries `sub` (user
   id), `name`, `email`, `role`, plus `iss`/`aud`.
3. The web app exposes a **JWKS endpoint** at `/api/auth/jwks.json` serving the
   RS256 public key (JWK form).
4. **BFF proxy:** a catch-all App Router route handler at
   `apps/web/app/api/proxy/[...path]/route.ts` attaches the RS256 JWT as a
   `Bearer` token (read server-side from the NextAuth session/token) and forwards
   to Nest. The browser never holds the token (httpOnly), never calls Nest
   directly.
5. **Nest** uses `passport-jwt` + **`jwks-rsa`** pointed at the web app's JWKS
   URL. Validates RS256 signature, `iss`, and `aud`. `JwtAuthGuard` protects
   routes; a `RolesGuard` + `@Roles('admin')` reads the `role` claim for admin.

Decisions:
- **Stateless JWT, no DB sessions table** (the Rails app had server-side
  sessions; the rewrite trades that for stateless RS256 JWTs per the chosen
  stack).
- Password reset: Nest issues a signed, expiring reset token; `/auth/forgot`
  requests it (email send is stubbed/logged in dev — same as Rails
  `deliver_later`), `/auth/reset` confirms. Resetting invalidates nothing
  server-side beyond changing the password (stateless sessions).

## Backend (Nest.js)

Modules mirror the Rails domain. Framework-free services hold the business logic.

| Module | Endpoints | Notes |
| --- | --- | --- |
| `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot`, `POST /auth/reset` | bcrypt; reset token signed/expiring |
| `fixtures` | `GET /fixtures?stage=` | grouped by date (upcoming) or by group/stage; includes the caller's predictions |
| `predictions` | `PUT /fixtures/:id/prediction` | upsert by (user, fixture); 422 if locked |
| `champion-picks` | `GET /champion-pick`, `PUT /champion-pick` | upsert; 422 once tournament started |
| `leaderboard` | `GET /leaderboard` | ranked rows, champion bonus at read time |
| `dashboard` | `GET /dashboard` | top-5 rows, my row, counts, champion pick + lock state |
| `admin/fixtures` | `GET /admin/fixtures?stage=&status=`, `PATCH /admin/fixtures/:id` | enter result → synchronous rescore |

Services (pure, framework-free, unit-tested):
- `ScoringService`: `pointsFor`, `scoreFixture(fixtureId)` (Drizzle transaction,
  idempotent, all-or-nothing), `championTeamId()`.
- `LeaderboardService`: the two-query aggregate + standard competition ranking +
  read-time champion bonus.
- Domain helpers: `isFixtureLocked(fixture)` (`kickoffAt <= now || status !==
  'scheduled'`), `tournamentStarted()` (earliest `kickoffAt <= now`). Reused by
  both validation and read endpoints.

Validation: a Zod validation pipe validates request bodies/params against
`contracts`. Lock/tournament rules enforced in the service layer, returning 422
with cause-agnostic messages matching the Rails copy.

## Data Layer (Drizzle, fresh Neon DB)

Fresh schema, camelCase in TS mapped to snake_case columns, **native Postgres
string enums** instead of integers.

- `users`: id, name, email (unique, normalized lowercase), passwordHash, role
  (`player` | `admin`, default `player`), timestamps.
- `teams`: id, name, code (unique, 3 uppercase letters), groupName (A–L),
  flagEmoji.
- `stadiums`: id, name, city, country.
- `fixtures`: id, homeTeamId, awayTeamId, stadiumId, kickoffAt, stage
  (`group|r32|r16|qf|sf|third_place|final`), status
  (`scheduled|live|finished`, default `scheduled`), homeScore (nullable),
  awayScore (nullable), timestamps. Constraint: a `finished` fixture must have
  both scores (enforced in service layer; DB allows null otherwise). Teams must
  differ.
- `predictions`: id, userId, fixtureId, homeScore, awayScore, pointsAwarded
  (nullable), timestamps. Unique (userId, fixtureId).
- `champion_picks`: id, userId (unique), teamId, timestamps.

No `sessions` table (NextAuth JWT strategy is stateless).

`seed.ts` recreates the demo world (ports `db/seeds.rb`):
- Admin (`admin@pitchpredict.app` / `worldcup2026`, role admin), demo player,
  and 12 players (`player1..12@pitchpredict.app`, same password).
- 48 real teams (groups A–L), host stadiums, real 2026 group-stage schedule.
- Two-phase seeding to satisfy lock rules: phase 1 creates fixtures with future
  kickoffs and seeds predictions + champion picks while open; phase 2 backdates
  the ~half group stage, records scores, marks finished, and rescores via
  `ScoringService.scoreFixture`. No bypassing of validation.

## Frontend (Next.js App Router + MUI, PWA)

**Custom MUI theme** matching the brand:
- primary `#0A7B4B` (pitch emerald), `#075C38` dark
- secondary/accent gold `#E8B53D`
- charcoal text `#111418`, off-white surface `#F7F8F6`
- rounded cards (`borderRadius` ~12–16px), soft card shadow
  `0 1px 2px rgb(17 20 24 / 0.04), 0 6px 24px -8px rgb(17 20 24 / 0.12)`.

**Data fetching:** TanStack Query throughout. Leaderboard query polls
(`refetchInterval` ~15s + `refetchOnWindowFocus`); admin scoring mutation
invalidates leaderboard + dashboard queries. All requests go through the BFF
proxy.

Screens (mobile-first, bottom navigation):
- **Dashboard** — your rank, total points, predicted/total counts, champion pick
  card (editable until tournament starts), top-5 mini leaderboard.
- **Predictions** grid — stage tabs (upcoming / group / r32 / r16 / qf / sf /
  third_place / final); upcoming grouped by date, group stage grouped by group.
  MUI fixture cards in open / locked / finished states. Reusable `ScoreStepper`
  component (+/- around a 0–20 numeric input) replacing the Stimulus stepper.
  Upsert on save with optimistic-ish feedback; 422 surfaces the lock message.
- **Leaderboard** — podium top-3 + full table; current user's row highlighted.
- **Admin** — fixtures list with stage/status filters; result-entry form →
  PATCH → invalidates queries.
- **Auth** — login, signup, forgot-password, reset-password pages (NextAuth
  Credentials + Nest endpoints).

**PWA:** installable manifest (name PitchPredict, theme `#0A7B4B`, standalone,
portrait, shortcuts to Predictions + Leaderboard), offline fallback page, and a
service worker with runtime caching (`next-pwa` or App Router manifest + custom
SW). Icons ported from the Rails `public/`.

## Testing & Tooling

- **Vitest** — `contracts` (Zod schemas) and Nest services (`ScoringService`,
  `LeaderboardService`, lock/tournament helpers). These port the highest-value
  Rails unit tests and are the correctness backbone.
- **Nest e2e** (supertest) — auth, prediction-lock, champion-pick-lock, admin
  scoring → leaderboard flows.
- **Playwright** — a couple of critical web flows (login → predict → leaderboard
  reflects a scored result).
- **ESLint + Prettier** via Nx; `nx run-many` build/lint/test as the gate.

## Out of Scope

- WebSocket/SSE real-time (replaced by polling).
- Background job queue (rescoring is synchronous).
- Real email delivery (reset email stubbed/logged in dev).
- Server-side session store (stateless JWT).

## Acceptance

- `nx run-many -t build lint test` passes.
- Seeded demo world loads; admin + demo logins work.
- A player can sign up, predict an open fixture, get locked out after kickoff,
  pick a champion before the tournament starts, and see the leaderboard.
- An admin can enter a result; the predictions rescore and the leaderboard
  updates (after refetch) with correct points and champion bonus.
- App is installable as a PWA with offline fallback.
