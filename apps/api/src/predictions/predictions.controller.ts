import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  predictionInputSchema,
  type Prediction,
  type PredictionInput,
} from '@pitchpredict/contracts';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { zodBody } from '../common/zod-validation.pipe';
import { PredictionsService } from './predictions.service';

/** Upsert the caller's prediction for a fixture. */
@UseGuards(JwtAuthGuard)
@Controller('fixtures')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Put(':id/prediction')
  upsert(
    @Param('id', ParseIntPipe) fixtureId: number,
    @Body(zodBody(predictionInputSchema)) input: PredictionInput,
    @CurrentUser() user: AuthUser
  ): Promise<Prediction> {
    return this.predictionsService.upsert(user.id, fixtureId, input);
  }
}
