import { Module } from '@nestjs/common';
import { ChampionPicksController } from './champion-picks.controller';
import { ChampionPicksService } from './champion-picks.service';

/** Champion pick read/upsert with tournament-start lock. DbModule is global. */
@Module({
  controllers: [ChampionPicksController],
  providers: [ChampionPicksService],
  exports: [ChampionPicksService],
})
export class ChampionPicksModule {}
