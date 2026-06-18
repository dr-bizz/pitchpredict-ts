import { db, schema } from '@pitchpredict/db';
import type { Dashboard } from '@pitchpredict/contracts';
import { asc, count, eq } from 'drizzle-orm';
import { rows as leaderboardRows } from './leaderboard';
import { championLocked as isChampionLocked } from './champion-picks';

/**
 * Aggregated dashboard payload for the caller. Mirrors the Rails
 * `DashboardController#show`: top-5 leaderboard rows, the caller's row, counts,
 * champion pick + lock, and (when unlocked) the team list for the picker.
 */
export async function forUser(userId: number, now: Date = new Date()): Promise<Dashboard> {
  const allRows = await leaderboardRows();
  const topRows = allRows.slice(0, 5);
  const myRow = allRows.find((row) => row.user.id === userId) ?? null;

  const [{ value: fixturesCount }] = await db
    .select({ value: count() })
    .from(schema.fixtures);
  const [{ value: predictedCount }] = await db
    .select({ value: count() })
    .from(schema.predictions)
    .where(eq(schema.predictions.userId, userId));

  const totalPoints = myRow?.totalPoints ?? 0;

  const pick = await db.query.championPicks.findFirst({
    where: eq(schema.championPicks.userId, userId),
    with: { team: true },
  });
  const championPick = pick
    ? { teamId: pick.teamId, team: pick.team }
    : null;

  const championLocked = isChampionLocked(now);
  const teams = championLocked
    ? []
    : await db.query.teams.findMany({
        orderBy: asc(schema.teams.name),
      });

  return {
    topRows,
    myRow,
    fixturesCount: Number(fixturesCount),
    predictedCount: Number(predictedCount),
    totalPoints,
    championPick,
    championLocked,
    teams,
  };
}
