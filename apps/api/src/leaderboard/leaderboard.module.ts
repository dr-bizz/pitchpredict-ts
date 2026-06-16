import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

/**
 * Provides the LeaderboardService + controller. Depends on ScoringModule for the
 * champion-team lookup used to derive the read-time champion bonus.
 */
@Module({
  imports: [ScoringModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
