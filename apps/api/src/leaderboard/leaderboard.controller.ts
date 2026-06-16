import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LeaderboardRow } from '@pitchpredict/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

/** The ranked leaderboard (polled live by the web app). */
@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  rows(): Promise<LeaderboardRow[]> {
    return this.leaderboardService.rows();
  }
}
