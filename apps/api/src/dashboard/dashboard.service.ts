import { Inject, Injectable } from '@nestjs/common';
import { schema } from '@pitchpredict/db';
import type { Dashboard } from '@pitchpredict/contracts';
import { asc, count, eq } from 'drizzle-orm';
import { ChampionPicksService } from '../champion-picks/champion-picks.service';
import { DRIZZLE, type DrizzleDb } from '../db/db.module';
import { LeaderboardService } from '../leaderboard/leaderboard.service';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly leaderboard: LeaderboardService,
    private readonly championPicks: ChampionPicksService
  ) {}

  /**
   * Aggregated dashboard payload for the caller. Mirrors the Rails
   * `DashboardController#show`: top-5 leaderboard rows, the caller's row, counts,
   * champion pick + lock, and (when unlocked) the team list for the picker.
   */
  async forUser(userId: number, now: Date = new Date()): Promise<Dashboard> {
    const rows = await this.leaderboard.rows();
    const topRows = rows.slice(0, 5);
    const myRow = rows.find((row) => row.user.id === userId) ?? null;

    const [{ value: fixturesCount }] = await this.db
      .select({ value: count() })
      .from(schema.fixtures);
    const [{ value: predictedCount }] = await this.db
      .select({ value: count() })
      .from(schema.predictions)
      .where(eq(schema.predictions.userId, userId));

    const totalPoints = myRow?.totalPoints ?? 0;

    const pick = await this.db.query.championPicks.findFirst({
      where: eq(schema.championPicks.userId, userId),
      with: { team: true },
    });
    const championPick = pick
      ? { teamId: pick.teamId, team: pick.team }
      : null;

    const championLocked = await this.championPicks.tournamentStarted(now);
    const teams = championLocked
      ? []
      : await this.db.query.teams.findMany({
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
}
