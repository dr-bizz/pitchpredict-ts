# PitchPredict

A World Cup 2026 prediction-game PWA. Players predict scores for each fixture,
pick a champion, and climb a live leaderboard. This is the TypeScript rewrite of
the original Rails app, built as an Nx monorepo.

## Architecture

- **`apps/web`** — Next.js 15 (App Router) + MUI v6 PWA. The browser talks
  **only** to the Next BFF proxy (`/api/proxy/*`), which attaches a NextAuth-issued
  RS256 JWT and forwards to the Nest API. Live leaderboard via TanStack Query polling.
- **`apps/api`** — Nest.js 11 REST API. Verifies the RS256 JWT against the web
  app's JWKS endpoint (`jwks-rsa`). Houses the framework-free business logic
  (scoring, leaderboard ranking, lock rules).
- **`libs/contracts`** — Shared Zod schemas + inferred types, used by both apps.
- **`libs/db`** — Drizzle ORM schema, Postgres (Neon) client, and the seed script.

Auth flow: browser → NextAuth session cookie → BFF signs RS256 JWT with the
private key → Nest verifies via the web app's `/api/auth/jwks.json`.

## Prerequisites

- Node 20+
- A Postgres database (Neon recommended)
- Dependencies are already installed (`node_modules` is present). If you need to
  reinstall: `npm install`.

## Setup

1. Copy the example env file and fill in values:

   ```bash
   cp .env.example .env
   ```

2. Generate an `AUTH_SECRET` and `AUTH_RESET_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

3. Generate the RS256 keypair used to sign/verify API tokens, and paste the PEM
   contents into `AUTH_JWT_PRIVATE_KEY` / `AUTH_JWT_PUBLIC_KEY` (newlines as
   literal `\n`):

   ```bash
   openssl genpkey -algorithm RSA -pkcs8 -out private.pem
   openssl rsa -in private.pem -pubout -out public.pem
   ```

### Environment variables

All keys live in `.env.example`. Summary:

| Key | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | db, api | Postgres connection string |
| `API_URL` | web | Base URL the BFF/NextAuth use to reach the Nest API (default `http://localhost:3334`) |
| `WEB_ORIGIN` | api | CORS origin for the web app (default `http://localhost:3000`) |
| `AUTH_URL` | web | Public URL of the web app (NextAuth) |
| `AUTH_SECRET` | web | Secret NextAuth uses to encrypt its session cookie |
| `AUTH_JWT_PRIVATE_KEY` | web | RS256 private key (PEM) used to sign API tokens |
| `AUTH_JWT_PUBLIC_KEY` | web | RS256 public key (PEM) exposed at `/api/auth/jwks.json` |
| `AUTH_JWKS_URI` | api | Where the API fetches the public JWKS (the web jwks.json route) |
| `AUTH_JWT_ISSUER` | web, api | `iss` claim, must match on both sides |
| `AUTH_JWT_AUDIENCE` | web, api | `aud` claim, must match on both sides |
| `AUTH_RESET_SECRET` | api | HS256 secret for password-reset tokens |

## Database

Generate and apply migrations, then seed:

```bash
npx nx run db:generate   # drizzle-kit generate — writes SQL migrations
npx nx run db:migrate    # drizzle-kit migrate — applies them to DATABASE_URL
npx nx run db:seed       # populate the demo world (destructive rebuild)
```

The seed creates 48 teams (groups A–L), stadiums, 2026 group-stage fixtures,
predictions, champion picks, and these logins (all password `worldcup2026`):

- `admin@pitchpredict.app` (admin — can enter results)
- `demo@pitchpredict.app`
- `player1@pitchpredict.app` … `player12@pitchpredict.app`

## Run

In two terminals (or background one):

```bash
npx nx serve api    # Nest API on http://localhost:3334
npx nx serve web    # Next.js on http://localhost:3000
```

Open http://localhost:3000 and log in with a seeded account.

## Test, lint, build

```bash
npx nx run-many -t test            # unit tests (Vitest + Jest)
npx nx run-many -t lint            # ESLint across all projects
npx nx run-many -t build           # production builds
npx nx run-many -t lint build test # everything
```

### End-to-end suites

Both e2e suites need a **seeded** Postgres (`nx run db:seed`). Without one they are
green by construction (skipped, with a notice) so `nx run-many -t test/lint` stays
clean in CI.

**API e2e** (`apps/api-e2e`, supertest) boots the Nest `AppModule` in-process with
its own ephemeral RS256/JWKS, then exercises: signup → login; predict open (200) vs
locked (422); champion-pick lock (422); admin result entry → leaderboard points; and
non-admin → 403. Point it at a seeded DB and run:

```bash
TEST_DATABASE_URL=postgres://… npx nx e2e api-e2e   # or: npx nx test api-e2e
```

**Web e2e** (`apps/web-e2e`, Playwright) drives the real UI: log in as demo →
predict an open fixture → save → leaderboard renders. It needs the API + web running
against a seeded DB. The Playwright config starts the web dev server; start the API
yourself. Enable the flow with `E2E_SEEDED=1`:

```bash
npx nx serve api                       # terminal 1 (seeded DATABASE_URL)
E2E_SEEDED=1 npx nx e2e web-e2e        # terminal 2 (starts web, runs the flow)
```

## Project layout

```
apps/
  web/         Next.js PWA (App Router, MUI, NextAuth, BFF proxy)
  web-e2e/     Playwright e2e
  api/         Nest.js REST API (scoring, leaderboard, fixtures, admin)
libs/
  contracts/   Shared Zod schemas + types
  db/          Drizzle schema, client, seed
```
