import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Dashboard } from '@pitchpredict/contracts';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

/** Aggregated dashboard payload for the caller. */
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  show(@CurrentUser() user: AuthUser): Promise<Dashboard> {
    return this.dashboardService.forUser(user.id);
  }
}
