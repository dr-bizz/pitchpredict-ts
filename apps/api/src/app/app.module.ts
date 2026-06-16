import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { DbModule } from '../db/db.module';
import { HealthController } from '../health/health.controller';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [HealthController],
  providers: [
    // RolesGuard runs after JwtAuthGuard (applied per-route); it no-ops unless
    // a handler declares @Roles(), so it is safe to register globally.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
