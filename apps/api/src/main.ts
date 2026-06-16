import * as dotenv from 'dotenv';
// Local dev loads env from the workspace-root .env.local (Next convention), then .env.
// In production, real environment variables are already present and take precedence.
dotenv.config({ path: ['.env.local', '.env'] });
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // The Next BFF maps client paths onto API paths, so no global prefix here.
  app.enableCors({ origin: env.webOrigin, credentials: true });
  await app.listen(env.port);
  Logger.log(`🚀 API running on: http://localhost:${env.port}`);
}

bootstrap();
