import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  adminFixtureQuerySchema,
  fixtureResultInputSchema,
  type AdminFixtureQuery,
  type FixtureResultInput,
  type FixtureWithTeams,
} from '@pitchpredict/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { zodBody, zodQuery } from '../common/zod-validation.pipe';
import { AdminFixturesService } from './admin-fixtures.service';

/** Admin-only fixtures listing + result entry (with synchronous rescore). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/fixtures')
export class AdminFixturesController {
  constructor(private readonly adminFixturesService: AdminFixturesService) {}

  @Get()
  list(
    @Query(zodQuery(adminFixtureQuerySchema)) query: AdminFixtureQuery
  ): Promise<FixtureWithTeams[]> {
    return this.adminFixturesService.list(query.stage, query.status);
  }

  @Patch(':id')
  enterResult(
    @Param('id', ParseIntPipe) fixtureId: number,
    @Body(zodBody(fixtureResultInputSchema)) input: FixtureResultInput
  ): Promise<FixtureWithTeams> {
    return this.adminFixturesService.enterResult(fixtureId, input);
  }
}
