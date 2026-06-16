/**
 * PitchPredict seed — World Cup 2026. Ported from the Rails `db/seeds.rb`.
 *
 * DESTRUCTIVE REBUILD: every run wipes all rows (predictions, champion picks,
 * fixtures, teams, stadiums, users) and recreates the demo world.
 *
 * The 48 teams, the 12 groups (A–L) AND the full group-stage schedule are the
 * REAL official tournament data (Final Draw 5 Dec 2025). Only the knockout
 * pairings are illustrative placeholders.
 *
 * Two-phase strategy to satisfy the kickoff-lock rules:
 *   Phase 1 — create every fixture with a *future* kickoff (past kickoffs are
 *     temporarily shifted +60 days), then create predictions and champion picks
 *     while the tournament is still "open".
 *   Phase 2 — backdate the ~half of the group stage whose real kickoff is in the
 *     past, record final scores, mark them finished, and recompute points
 *     (mirrors `ScoringService.scoreFixture`).
 *
 * Run with: `nx run db:seed` (or `tsx libs/db/src/seed.ts`). Requires a live
 * `DATABASE_URL`. This module also typechecks without one — `seedDatabase` only
 * touches the DB when called.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db as singletonDb, type Db } from './client';
import { CONTENDER_CODES, TEAMS } from './seed-data/teams';
import { STADIUMS } from './seed-data/stadiums';
import { buildFixtureSpecs } from './seed-data/fixtures';
import * as schema from './schema';

const SEED_PASSWORD = 'worldcup2026';
const BCRYPT_COST = 12;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PROVISIONAL_SHIFT_DAYS = 60;

// Point scale — kept in lockstep with the Nest `ScoringService`.
const EXACT = 4;
const DIFFERENCE = 3;
const TENDENCY = 2;

const PLAYER_NAMES = [
  'Maya Okafor',
  'Liam Castellanos',
  'Priya Raman',
  'Jonas Weber',
  'Sofia Marchetti',
  'Tomás Herrera',
  'Aisha Diallo',
  'Kenji Nakamura',
  "Hannah O'Brien",
  'Mateus Figueiredo',
  'Ingrid Sørensen',
  'Omar Haddad',
] as const;

// Realistic-ish goal distribution (mean ~1.3 goals a side). Mirrors Rails.
const GOAL_WEIGHTS = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4] as const;

/**
 * Deterministic PRNG (mulberry32) so every replant produces the same world.
 * Rails seeds with `Random.new(2026)`; we cannot reproduce its exact stream, but
 * a fixed seed here gives stable output across our own runs.
 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(2026);

function randomGoals(): number {
  return GOAL_WEIGHTS[Math.floor(rng() * GOAL_WEIGHTS.length)];
}

/** Random float in [min, max). */
function randomFloat(min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Pick one element. */
function sampleOne<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Pick `n` distinct elements (Fisher–Yates partial shuffle). */
function sampleMany<T>(items: readonly T[], n: number): T[] {
  const pool = [...items];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Points for a single prediction — mirrors `ScoringService.pointsFor`. */
function pointsFor(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return EXACT;
  }
  if (predictedHome - predictedAway === actualHome - actualAway) {
    return DIFFERENCE;
  }
  if (
    Math.sign(predictedHome - predictedAway) ===
    Math.sign(actualHome - actualAway)
  ) {
    return TENDENCY;
  }
  return 0;
}

/**
 * Seed (or re-seed) the database. Accepts an injectable `Db` so tests can pass a
 * throwaway connection; defaults to the shared singleton.
 */
export async function seedDatabase(db: Db = singletonDb): Promise<void> {
  const now = new Date();

  console.log('== Clearing existing data (destructive replant) ==');
  // Delete in FK-safe order. `delete` with no where clears the table.
  await db.delete(schema.predictions);
  await db.delete(schema.championPicks);
  await db.delete(schema.fixtures);
  await db.delete(schema.teams);
  await db.delete(schema.stadiums);
  await db.delete(schema.users);

  console.log('== Stadiums ==');
  const insertedStadiums = await db
    .insert(schema.stadiums)
    .values(STADIUMS.map((s) => ({ name: s.name, city: s.city, country: s.country })))
    .returning();

  console.log('== Teams ==');
  const insertedTeams = await db
    .insert(schema.teams)
    .values(
      TEAMS.map((t) => ({
        name: t.name,
        code: t.code,
        groupName: t.groupName,
        flagEmoji: t.flagEmoji,
      }))
    )
    .returning();

  // The seed-data TEAMS order is preserved by `.returning()`, so bracket slot
  // indices (group order) map directly onto insertedTeams.
  const teamByCode = new Map(insertedTeams.map((t) => [t.code, t]));

  // ---- Phase 1: fixtures with future kickoffs --------------------------------
  console.log('== Fixtures ==');
  const specs = buildFixtureSpecs();
  // Real kickoff per inserted fixture id, so Phase 2 can backdate + score.
  const realKickoffById = new Map<number, Date>();
  const groupFixtureIds: number[] = [];

  for (const spec of specs) {
    const stadium = insertedStadiums[spec.stadiumIdx];
    let homeTeamId: number;
    let awayTeamId: number;
    if ('home' in spec.ref) {
      const home = teamByCode.get(spec.ref.home);
      const away = teamByCode.get(spec.ref.away);
      if (!home || !away) {
        throw new Error(
          `Unknown team code in fixture spec: ${spec.ref.home} vs ${spec.ref.away}`
        );
      }
      homeTeamId = home.id;
      awayTeamId = away.id;
    } else {
      homeTeamId = insertedTeams[spec.ref.homeSlot].id;
      awayTeamId = insertedTeams[spec.ref.awaySlot].id;
    }

    const realKickoff = spec.kickoffAt;
    // Float past kickoffs into the future so predictions stay creatable.
    const provisional =
      realKickoff <= now
        ? new Date(realKickoff.getTime() + PROVISIONAL_SHIFT_DAYS * MS_PER_DAY)
        : realKickoff;

    const [fixture] = await db
      .insert(schema.fixtures)
      .values({
        homeTeamId,
        awayTeamId,
        stadiumId: stadium.id,
        kickoffAt: provisional,
        stage: spec.stage,
      })
      .returning();

    realKickoffById.set(fixture.id, realKickoff);
    if (spec.stage === 'group') {
      groupFixtureIds.push(fixture.id);
    }
  }

  // ---- Users -----------------------------------------------------------------
  console.log('== Users ==');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);

  const [admin] = await db
    .insert(schema.users)
    .values({
      name: 'Tournament Admin',
      email: 'admin@pitchpredict.app',
      passwordHash,
      role: 'admin',
    })
    .returning();
  void admin;

  const playerRows = [
    { name: 'Dani Demo', email: 'demo@pitchpredict.app' },
    ...PLAYER_NAMES.map((name, i) => ({
      name,
      email: `player${i + 1}@pitchpredict.app`,
    })),
  ];
  const players = await db
    .insert(schema.users)
    .values(
      playerRows.map((p) => ({
        name: p.name,
        email: p.email,
        passwordHash,
        role: 'player' as const,
      }))
    )
    .returning();

  // ---- Predictions + champion picks (while every fixture is open) ------------
  console.log('== Predictions and champion picks ==');
  const contenderTeams = CONTENDER_CODES.map((code) => {
    const team = teamByCode.get(code);
    if (!team) throw new Error(`Unknown contender code: ${code}`);
    return team;
  });

  for (const player of players) {
    const coverage = randomFloat(0.6, 1.0); // 60–100% of group games
    const picked = sampleMany(
      groupFixtureIds,
      Math.round(groupFixtureIds.length * coverage)
    );
    if (picked.length > 0) {
      await db.insert(schema.predictions).values(
        picked.map((fixtureId) => ({
          userId: player.id,
          fixtureId,
          homeScore: randomGoals(),
          awayScore: randomGoals(),
        }))
      );
    }
    await db.insert(schema.championPicks).values({
      userId: player.id,
      teamId: sampleOne(contenderTeams).id,
    });
  }

  // ---- Phase 2: backdate past fixtures, record results, score ----------------
  console.log('== Results for fixtures already played ==');
  let finished = 0;
  for (const [fixtureId, realKickoff] of realKickoffById) {
    if (realKickoff > now) continue;

    const homeScore = randomGoals();
    const awayScore = randomGoals();
    await db
      .update(schema.fixtures)
      .set({
        kickoffAt: realKickoff,
        status: 'finished',
        homeScore,
        awayScore,
        updatedAt: new Date(),
      })
      .where(eq(schema.fixtures.id, fixtureId));

    // Inline scoreFixture: recompute pointsAwarded for every prediction.
    const fixturePredictions = await db.query.predictions.findMany({
      where: eq(schema.predictions.fixtureId, fixtureId),
    });
    for (const prediction of fixturePredictions) {
      const points = pointsFor(
        prediction.homeScore,
        prediction.awayScore,
        homeScore,
        awayScore
      );
      await db
        .update(schema.predictions)
        .set({ pointsAwarded: points, updatedAt: new Date() })
        .where(eq(schema.predictions.id, prediction.id));
    }
    finished += 1;
  }

  console.log(
    `Seeded: ${insertedTeams.length} teams, ${insertedStadiums.length} stadiums, ` +
      `${specs.length} fixtures (${finished} finished), ` +
      `${players.length + 1} users.`
  );
  console.log('== Login credentials ==');
  console.log('  Admin: admin@pitchpredict.app / worldcup2026');
  console.log('  Demo:  demo@pitchpredict.app  / worldcup2026');
}

// Run directly (tsx libs/db/src/seed.ts).
const isMain = (() => {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('seed.ts') || entry.endsWith('seed.js');
})();

if (isMain) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
