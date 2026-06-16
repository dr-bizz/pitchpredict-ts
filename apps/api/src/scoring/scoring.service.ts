import { Inject, Injectable } from '@nestjs/common';
import { schema } from '@pitchpredict/db';
import { and, eq } from 'drizzle-orm';
import { BusinessException } from '../common/business.exception';
import { DRIZZLE, type DrizzleDb } from '../db/db.module';

/**
 * All scoring math lives here. Controllers and other services must never compute
 * points themselves — they call into this service. Ported from the Rails
 * `ScoringService`.
 *
 * Point scale per prediction:
 *   4 — exact scoreline
 *   3 — correct goal difference, but not the exact score (includes draws
 *       predicted as draws with the wrong score, since 0 === 0)
 *   2 — correct outcome (home win / draw / away win) only
 *   0 — everything else
 */
@Injectable()
export class ScoringService {
  static readonly EXACT = 4;
  static readonly DIFFERENCE = 3;
  static readonly TENDENCY = 2;
  static readonly CHAMPION_BONUS = 10;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Points for a single prediction against the actual result. Pure function,
   * mirrors the Rails `points_for`.
   */
  pointsFor(
    predictedHome: number,
    predictedAway: number,
    actualHome: number,
    actualAway: number
  ): number {
    if (predictedHome === actualHome && predictedAway === actualAway) {
      return ScoringService.EXACT;
    }
    if (predictedHome - predictedAway === actualHome - actualAway) {
      return ScoringService.DIFFERENCE;
    }
    if (Math.sign(predictedHome - predictedAway) === Math.sign(actualHome - actualAway)) {
      return ScoringService.TENDENCY;
    }
    return 0;
  }

  /**
   * Recompute and persist `pointsAwarded` for every prediction of the fixture.
   * Idempotent — safe to re-run if a result is corrected later. Runs in a Drizzle
   * transaction so a mid-loop failure cannot leave standings half-updated. Throws
   * (422) if the fixture is not finished, since scoring an unfinished fixture is a
   * caller bug.
   */
  async scoreFixture(fixtureId: number): Promise<void> {
    const fixture = await this.db.query.fixtures.findFirst({
      where: eq(schema.fixtures.id, fixtureId),
    });
    if (!fixture) {
      throw new BusinessException(`Fixture ${fixtureId} not found`);
    }
    if (fixture.status !== 'finished') {
      throw new BusinessException(`Fixture ${fixtureId} is not finished`);
    }
    // Belt-and-braces: a finished fixture always has scores, but guard so the
    // arithmetic below never sees null.
    if (fixture.homeScore === null || fixture.awayScore === null) {
      throw new BusinessException(`Fixture ${fixtureId} has no recorded score`);
    }
    const actualHome = fixture.homeScore;
    const actualAway = fixture.awayScore;

    await this.db.transaction(async (tx) => {
      const fixturePredictions = await tx.query.predictions.findMany({
        where: eq(schema.predictions.fixtureId, fixtureId),
      });
      for (const prediction of fixturePredictions) {
        const points = this.pointsFor(
          prediction.homeScore,
          prediction.awayScore,
          actualHome,
          actualAway
        );
        await tx
          .update(schema.predictions)
          .set({ pointsAwarded: points, updatedAt: new Date() })
          .where(eq(schema.predictions.id, prediction.id));
      }
    });
  }

  /**
   * The champion bonus is never persisted — it is derived at read time. Returns
   * the winning team id of the finished final, or null if the final has not
   * finished or somehow ended level (no bonus awarded). Mirrors the Rails
   * `champion_team_id`.
   */
  async championTeamId(): Promise<number | null> {
    const final = await this.db.query.fixtures.findFirst({
      where: and(
        eq(schema.fixtures.stage, 'final'),
        eq(schema.fixtures.status, 'finished')
      ),
    });
    if (
      !final ||
      final.homeScore === null ||
      final.awayScore === null ||
      final.homeScore === final.awayScore
    ) {
      return null;
    }
    return final.homeScore > final.awayScore
      ? final.homeTeamId
      : final.awayTeamId;
  }
}
