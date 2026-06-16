import { Module } from '@nestjs/common';
import { ScoringModule } from '../scoring/scoring.module';
import { AdminFixturesController } from './admin-fixtures.controller';
import { AdminFixturesService } from './admin-fixtures.service';

/**
 * Admin-only fixtures management. Depends on ScoringModule to rescore predictions
 * synchronously after a result is entered. DbModule is global.
 */
@Module({
  imports: [ScoringModule],
  controllers: [AdminFixturesController],
  providers: [AdminFixturesService],
})
export class AdminModule {}
