import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { ChampionPicksModule } from '../champion-picks/champion-picks.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DbModule } from '../db/db.module';
import { FixturesModule } from '../fixtures/fixtures.module';
import { HealthController } from '../health/health.controller';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { PredictionsModule } from '../predictions/predictions.module';

/**
 * Root module. Feature modules each apply their own guards per-route
 * (`@UseGuards(JwtAuthGuard[, RolesGuard])`) so that `request.user` is populated
 * by the JWT guard *before* the roles check runs — hence no global APP_GUARD here.
 */
@Module({
  imports: [
    DbModule,
    AuthModule,
    FixturesModule,
    PredictionsModule,
    ChampionPicksModule,
    LeaderboardModule,
    DashboardModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
