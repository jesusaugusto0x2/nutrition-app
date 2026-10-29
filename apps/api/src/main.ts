import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/app-config';

export const API_PREFIX = 'api';

async function bootstrap() {
  // Local development reads the root .env (Nx runs the app from the
  // workspace root). Deployed environments inject variables directly.
  const envFile = resolve(process.cwd(), '.env');
  if (process.env.NODE_ENV !== 'production' && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable('x-powered-by');
  // Fills req.cookies for the session cookie (unsigned: the token is opaque).
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.PORT);
  Logger.log(
    `API listening on http://localhost:${config.PORT}/${API_PREFIX} (${config.NODE_ENV})`,
    'Bootstrap',
  );
}

void bootstrap();
