import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { fixtureQuerySchema, type FixtureQuery } from '@pitchpredict/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { zodQuery } from '../common/zod-validation.pipe';
import { FixturesService, type FixturesResponse } from './fixtures.service';

/** Authenticated fixtures listing for the predictions grid. */
@UseGuards(JwtAuthGuard)
@Controller('fixtures')
export class FixturesController {
  constructor(private readonly fixturesService: FixturesService) {}

  @Get()
  list(
    @Query(zodQuery(fixtureQuerySchema)) query: FixtureQuery,
    @CurrentUser() user: AuthUser
  ): Promise<FixturesResponse> {
    return this.fixturesService.list(query.stage, user.id);
  }
}
