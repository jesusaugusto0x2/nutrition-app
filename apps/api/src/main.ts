import { existsSync } from 'node:fs';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/app-config';

export const API_PREFIX = 'api';

/**
 * Node tries IPv6 and IPv4 addresses in turn and gives each connection attempt
 * 250 ms by default. On a network without IPv6, an IPv4 handshake slower than
 * that fails the whole `fetch` (`TypeError: fetch failed`, ETIMEDOUT), which
 * broke Google sign-in. A longer attempt only waits when a handshake is slow.
 */
const CONNECTION_ATTEMPT_TIMEOUT_MS = 2_000;

async function bootstrap() {
  setDefaultAutoSelectFamilyAttemptTimeout(CONNECTION_ATTEMPT_TIMEOUT_MS);

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
