import { db, schema } from '@pitchpredict/db';
import type { ChampionPick, ChampionPickInput } from '@pitchpredict/contracts';
import { asc, eq } from 'drizzle-orm';
import { tournamentStarted } from '../domain/fixture-rules';
import { BusinessError } from '../errors';

/** The caller's current champion pick, or null if none. */
export async function forUser(userId: number): Promise<ChampionPick | null> {
  const row = await db.query.championPicks.findFirst({
    where: eq(schema.championPicks.userId, userId),
  });
  return row ?? null;
}

/**
 * Upsert the caller's champion pick (one per user). Rejects with 422 once the
 * tournament has started. Mirrors `ChampionPicksController#upsert_champion_pick`.
 */
export async function upsert(
  userId: number,
  input: ChampionPickInput,
  now: Date = new Date()
): Promise<ChampionPick> {
  if (await tournamentStartedCheck(now)) {
    throw new BusinessError(
      'Champion picks are locked once the tournament has started'
    );
  }

  const [row] = await db
    .insert(schema.championPicks)
    .values({ userId, teamId: input.teamId })
    .onConflictDoUpdate({
      target: schema.championPicks.userId,
      set: { teamId: input.teamId, updatedAt: new Date() },
    })
    .returning();

  return row;
}

/** True once the earliest fixture's kickoff has passed. */
export async function tournamentStartedCheck(now: Date = new Date()): Promise<boolean> {
  const earliest = await db.query.fixtures.findFirst({
    orderBy: asc(schema.fixtures.kickoffAt),
    columns: { kickoffAt: true },
  });
  return tournamentStarted(earliest?.kickoffAt ?? null, now);
}
