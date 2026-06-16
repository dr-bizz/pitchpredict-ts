import { Module } from '@nestjs/common';
import { ChampionPicksModule } from '../champion-picks/champion-picks.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Dashboard aggregate. Reuses LeaderboardService (top rows / my row) and
 * ChampionPicksService (tournament-start lock). DbModule is global.
 */
@Module({
  imports: [LeaderboardModule, ChampionPicksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
