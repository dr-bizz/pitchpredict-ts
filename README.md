# PitchPredict

A World Cup 2026 prediction-game PWA. Players predict scores for each fixture,
pick a champion, and climb a live leaderboard. This is the TypeScript rewrite of
the original Rails app, built as an Nx monorepo.

## Architecture

- **`apps/web`** — Next.js 15 (App Router) + MUI v6 PWA. The browser talks
  to the app's own `/api/*` route handlers (no separate backend service). Live
  leaderboard via TanStack Query polling.
- **`libs/contracts`** — Shared Zod schemas + inferred types.
- **`libs/db`** — Drizzle ORM schema, Postgres (Neon) client, and the seed script.

Auth flow: browser → NextAuth session cookie → Next.js API route handlers verify
the session and run business logic directly against the database.

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

### Environment variables

All keys live in `.env.example`. Summary:

| Key | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_URL` | Public URL of the web app (NextAuth) |
| `AUTH_SECRET` | Secret NextAuth uses to encrypt its session cookie |
| `AUTH_RESET_SECRET` | HS256 secret for password-reset tokens |

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

```bash
npx nx serve web    # Next.js on http://localhost:3000
```

Open http://localhost:3000 and log in with a seeded account.

## Test, lint, build

```bash
npx nx run-many -t test            # unit tests (Vitest)
npx nx run-many -t lint            # ESLint across all projects
npx nx run-many -t build           # production builds
npx nx run-many -t lint build test # everything
```

### End-to-end suite

The web e2e suite needs a **seeded** Postgres (`nx run db:seed`). Without one it is
green by construction (skipped, with a notice) so `nx run-many -t test/lint` stays
clean in CI.

**Web e2e** (`apps/web-e2e`, Playwright) drives the real UI: log in as demo →
predict an open fixture → save → leaderboard renders. Enable the flow with
`E2E_SEEDED=1`:

```bash
E2E_SEEDED=1 npx nx e2e web-e2e   # starts the web dev server and runs the flow
```

## Project layout

```
apps/
  web/         Next.js PWA (App Router, MUI, NextAuth, API route handlers)
  web-e2e/     Playwright e2e
libs/
  contracts/   Shared Zod schemas + types
  db/          Drizzle schema, client, seed
```
