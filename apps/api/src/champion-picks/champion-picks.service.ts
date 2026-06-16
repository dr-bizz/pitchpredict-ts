import { Inject, Injectable } from '@nestjs/common';
import { schema } from '@pitchpredict/db';
import type { ChampionPick, ChampionPickInput } from '@pitchpredict/contracts';
import { asc, eq } from 'drizzle-orm';
import { BusinessException } from '../common/business.exception';
import { DRIZZLE, type DrizzleDb } from '../db/db.module';
import { tournamentStarted } from '../domain/fixture-rules';

@Injectable()
export class ChampionPicksService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** The caller's current champion pick, or null if none. */
  async forUser(userId: number): Promise<ChampionPick | null> {
    const row = await this.db.query.championPicks.findFirst({
      where: eq(schema.championPicks.userId, userId),
    });
    return row ?? null;
  }

  /**
   * Upsert the caller's champion pick (one per user). Rejects with 422 once the
   * tournament has started. Mirrors `ChampionPicksController#upsert_champion_pick`.
   */
  async upsert(
    userId: number,
    input: ChampionPickInput,
    now: Date = new Date()
  ): Promise<ChampionPick> {
    if (await this.tournamentStarted(now)) {
      throw new BusinessException(
        'Champion picks are locked once the tournament has started'
      );
    }

    const [row] = await this.db
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
  async tournamentStarted(now: Date = new Date()): Promise<boolean> {
    const earliest = await this.db.query.fixtures.findFirst({
      orderBy: asc(schema.fixtures.kickoffAt),
      columns: { kickoffAt: true },
    });
    return tournamentStarted(earliest?.kickoffAt ?? null, now);
  }
}
