import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { LeaderboardService } from './leaderboard.service';

/**
 * Provides the LeaderboardService. Depends on ScoringModule for the champion-team
 * lookup used to derive the read-time champion bonus. The leaderboard controller
 * (Phase 6) imports this module.
 */
@Module({
  imports: [ScoringModule],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
