import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { schema } from '@pitchpredict/db';
import type { Prediction, PredictionInput } from '@pitchpredict/contracts';
import { eq } from 'drizzle-orm';
import { BusinessException } from '../common/business.exception';
import { DRIZZLE, type DrizzleDb } from '../db/db.module';
import { isFixtureLocked } from '../domain/fixture-rules';

@Injectable()
export class PredictionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Upsert the caller's prediction for a fixture (keyed on userId + fixtureId).
   * Rejects with 422 when the fixture is locked, matching the Rails copy. Mirrors
   * the singular-resource upsert from `PredictionsController`.
   */
  async upsert(
    userId: number,
    fixtureId: number,
    input: PredictionInput,
    now: Date = new Date()
  ): Promise<Prediction> {
    const fixture = await this.db.query.fixtures.findFirst({
      where: eq(schema.fixtures.id, fixtureId),
    });
    if (!fixture) {
      throw new NotFoundException(`Fixture ${fixtureId} not found`);
    }
    if (
      isFixtureLocked({ kickoffAt: fixture.kickoffAt, status: fixture.status }, now)
    ) {
      throw new BusinessException('Predictions are locked for this match');
    }

    const [row] = await this.db
      .insert(schema.predictions)
      .values({
        userId,
        fixtureId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
      })
      .onConflictDoUpdate({
        target: [schema.predictions.userId, schema.predictions.fixtureId],
        set: {
          homeScore: input.homeScore,
          awayScore: input.awayScore,
          updatedAt: new Date(),
        },
      })
      .returning();

    return row;
  }
}
