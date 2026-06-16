import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  championPickInputSchema,
  type ChampionPick,
  type ChampionPickInput,
} from '@pitchpredict/contracts';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { zodBody } from '../common/zod-validation.pipe';
import { ChampionPicksService } from './champion-picks.service';

/** The caller's singular champion pick. */
@UseGuards(JwtAuthGuard)
@Controller('champion-pick')
export class ChampionPicksController {
  constructor(private readonly championPicksService: ChampionPicksService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ChampionPick | null> {
    return this.championPicksService.forUser(user.id);
  }

  @Put()
  upsert(
    @Body(zodBody(championPickInputSchema)) input: ChampionPickInput,
    @CurrentUser() user: AuthUser
  ): Promise<ChampionPick> {
    return this.championPicksService.upsert(user.id, input);
  }
}
