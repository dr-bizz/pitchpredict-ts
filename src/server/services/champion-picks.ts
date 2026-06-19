import { db, schema } from '@pitchpredict/db';
import type { ChampionPick, ChampionPickInput } from '@pitchpredict/contracts';
import { eq } from 'drizzle-orm';
import { championPicksLocked } from '../domain/fixture-rules';
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
 * champion-pick deadline has passed. Mirrors `ChampionPicksController#upsert_champion_pick`.
 */
export async function upsert(
  userId: number,
  input: ChampionPickInput,
  now: Date = new Date()
): Promise<ChampionPick> {
  if (championLocked(now)) {
    throw new BusinessError(
      'Champion picks closed on Sat Jun 20, 6:00 PM ET'
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

/** True once the fixed champion-pick deadline has passed. No DB query needed. */
export function championLocked(now: Date = new Date()): boolean {
  return championPicksLocked(now);
}
