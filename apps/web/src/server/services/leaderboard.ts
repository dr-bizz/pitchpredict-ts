import { db, schema } from '@pitchpredict/db';
import type { LeaderboardRow } from '@pitchpredict/contracts';
import { eq, sql } from 'drizzle-orm';
import { CHAMPION_BONUS, EXACT, DIFFERENCE, TENDENCY, championTeamId } from './scoring';

/** Shape of one grouped aggregate row before ranking/bonus is applied. */
interface AggregatedUser {
  id: number;
  name: string;
  email: string;
  role: 'player' | 'admin';
  totalPoints: number;
  predictionsCount: number;
  exactCount: number;
  diffCount: number;
  tendencyCount: number;
}

/**
 * Builds the ranked leaderboard in two queries total (one grouped aggregate over
 * users + predictions, one pluck for champion picks) — no N+1. Ported from the
 * Rails `LeaderboardService`.
 *
 * Ranking is standard competition ranking ("1224"): equal *total points* share a
 * rank and the next rank skips. The secondary ordering (exact count desc, then
 * name asc) only controls stable display order — it does not affect rank. The
 * champion bonus is added here at read time once the final has finished.
 */
export async function rows(): Promise<LeaderboardRow[]> {
  const [aggregated, bonusUserIds] = await Promise.all([
    aggregatedUsers(),
    championBonusUserIds(),
  ]);

  const withBonus = aggregated.map((u) => ({
    user: u,
    totalPoints:
      u.totalPoints +
      (bonusUserIds.has(u.id) ? CHAMPION_BONUS : 0),
  }));

  withBonus.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.user.exactCount !== a.user.exactCount) {
      return b.user.exactCount - a.user.exactCount;
    }
    return a.user.name.localeCompare(b.user.name);
  });

  let previousTotal: number | null = null;
  let previousRank = 0;
  return withBonus.map((row, index) => {
    const rank =
      previousTotal !== null && previousTotal === row.totalPoints
        ? previousRank
        : index + 1;
    previousTotal = row.totalPoints;
    previousRank = rank;

    return {
      rank,
      user: {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        role: row.user.role,
      },
      totalPoints: row.totalPoints,
      predictionsCount: row.user.predictionsCount,
      exactCount: row.user.exactCount,
      diffCount: row.user.diffCount,
      tendencyCount: row.user.tendencyCount,
    };
  });
}

async function aggregatedUsers(): Promise<AggregatedUser[]> {
  const countWhere = (points: number) =>
    sql<number>`COALESCE(SUM(CASE WHEN ${schema.predictions.pointsAwarded} = ${points} THEN 1 ELSE 0 END), 0)`;

  const dbRows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      totalPoints: sql<number>`COALESCE(SUM(${schema.predictions.pointsAwarded}), 0)`,
      predictionsCount: sql<number>`COUNT(${schema.predictions.id})`,
      exactCount: countWhere(EXACT),
      diffCount: countWhere(DIFFERENCE),
      tendencyCount: countWhere(TENDENCY),
    })
    .from(schema.users)
    .leftJoin(
      schema.predictions,
      eq(schema.predictions.userId, schema.users.id)
    )
    .groupBy(schema.users.id);

  // Postgres returns bigint aggregates as strings via postgres-js; coerce.
  return dbRows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    email: r.email,
    role: r.role,
    totalPoints: Number(r.totalPoints),
    predictionsCount: Number(r.predictionsCount),
    exactCount: Number(r.exactCount),
    diffCount: Number(r.diffCount),
    tendencyCount: Number(r.tendencyCount),
  }));
}

async function championBonusUserIds(): Promise<Set<number>> {
  const championId = await championTeamId();
  if (championId === null) {
    return new Set();
  }
  const dbRows = await db
    .select({ userId: schema.championPicks.userId })
    .from(schema.championPicks)
    .where(eq(schema.championPicks.teamId, championId));
  return new Set(dbRows.map((r) => Number(r.userId)));
}
