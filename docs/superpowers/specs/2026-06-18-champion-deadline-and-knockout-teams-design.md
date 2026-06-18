# Champion-pick deadline + blank knockout teams — design

Date: 2026-06-18
Status: Approved

Two independent features against this app's own (Neon) database. The Rails app
and its database stay separate — no shared DB.

## Feature 1 — Champion-pick deadline (fixed date)

Today champion picks lock the instant the earliest fixture kicks off
(`tournamentStarted`). Since the group stage is already underway, picks are
currently locked. Change the lock to a fixed deadline.

- **Deadline:** `CHAMPION_PICK_DEADLINE = 2026-06-20T22:00:00Z` (Sat Jun 20,
  6:00 PM US Eastern / EDT, UTC-4).
- **Domain** (`apps/web/src/server/domain/fixture-rules.ts`): replace
  `tournamentStarted(earliestKickoff, now)` with
  `championPicksLocked(now, deadline = CHAMPION_PICK_DEADLINE)` → `now >= deadline`.
  No DB query needed.
- **Service** (`champion-picks.ts`): `upsert` guard and the exported lock check
  use the new rule; drop the earliest-fixture query (`tournamentStartedCheck`).
- **Dashboard** (`dashboard.ts`): `championLocked` uses the same rule.
- **UI**: show "Champion picks close Sat Jun 20, 6:00 PM ET" near the picker.
- **Tests**: champion-picks / dashboard specs updated to the fixed deadline
  (before → open, after → locked), injecting `now`.

## Feature 2 — Blank knockout teams + admin assignment

The knockout rounds (`r32`, `r16`, `qf`, `sf`, `third_place`, `final`) are
seeded with fabricated team/venue/date placeholders. Keep one fixture row per
knockout match (bracket visible) but blank the teams; admin assigns teams as
groups conclude.

### Data model
- Make `fixtures.home_team_id` / `away_team_id` **nullable** (drizzle migration:
  `DROP NOT NULL`).
- **Non-destructive** data fix in the same migration:
  `UPDATE fixtures SET home_team_id = NULL, away_team_id = NULL WHERE stage <> 'group'`.
  Users / predictions / champion picks untouched.
- Update `seed.ts` so future re-seeds create knockout fixtures with **null
  teams** (group stage unchanged). Do **not** apply the destructive seed to the
  live DB — the migration handles the in-place blanking.

### Contracts
- `fixtureWithTeamsSchema.homeTeam` / `awayTeam` become `teamSchema.nullable()`
  (the underlying `homeTeamId` / `awayTeamId` become nullable automatically from
  the schema change).
- New `fixtureTeamsInputSchema` = `{ homeTeamId: number|null, awayTeamId: number|null }`.

### Domain rule
- A fixture with a missing team is **not predictable**: extend `isFixtureLocked`
  so a null home/away team ⇒ locked. Once both teams are assigned it unlocks if
  kickoff is still in the future and status is `scheduled`.

### Read paths / UI
- `FixtureCard.tsx`: render **"TBD"** + neutral placeholder when a team is null,
  and disable the score inputs (locked).
- Predictions grid (`app/(app)/page.tsx`) and admin list (`app/(app)/admin/page.tsx`)
  flow null teams through unchanged (group-name grouping only runs for the group
  stage, which always has teams).

### Admin assignment
- New service `assignTeams(fixtureId, { homeTeamId, awayTeamId })` in
  `admin-fixtures.ts` — admin-only; rejects group-stage fixtures; requires two
  **distinct**, existing teams; allows clearing back to null.
- New route handler `PATCH /api/admin/fixtures/[id]/teams` + API-client method.
- Admin page gains a **"Knockout teams"** section: knockout fixtures grouped by
  stage (R32 → Final), each row with home/away team dropdowns (all 48 teams) +
  Save.
- Scores stay on the existing "enter result" flow — unchanged.

### Tests
- `assignTeams` service: happy path, group-stage rejection, duplicate-team
  rejection (mock `@pitchpredict/db` + `drizzle-orm`, per existing spec pattern).
- `fixture-rules`: TBD (missing-team) lock; champion deadline before/after.
- Nullable contract round-trip.

## Decisions / notes
- Existing predictions on knockout fixtures are **left intact** (none are scored
  yet — those matches are in the future).
- Admin assignment covers **teams only**; kickoff/stadium keep their existing
  (placeholder) values. Knockout lock timing therefore stays approximate until
  adjusted later — accepted for now.
