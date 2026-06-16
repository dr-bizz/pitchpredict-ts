import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';

/**
 * Exposes the framework-free ScoringService for injection (e.g. by the admin
 * rescore flow and the LeaderboardService). The DbModule is global, so the
 * `DRIZZLE` dependency is satisfied without importing it here.
 */
@Module({
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
