import {
  Controller,
  Get,
  type INestApplication,
  InternalServerErrorException,
  type LoggerService,
  Req,
  Res,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import {
  DEVELOPMENT_SESSION_COOKIE,
  PRODUCTION_SESSION_COOKIE,
  SessionCookie,
} from './session-cookie';

const TOKEN = 'TestToken_0123456789-abcdefghijklmnopqrstuv';
const EXPIRES_AT = new Date('2026-02-09T12:00:00.000Z');

@Controller()
class TestController {
  constructor(private readonly cookie: SessionCookie) {}

  @Get('set')
  set(@Res({ passthrough: true }) response: Response): void {
    this.cookie.set(response, TOKEN, EXPIRES_AT);
  }

  @Get('clear')
  clear(@Res({ passthrough: true }) response: Response): void {
    this.cookie.clear(response);
  }

  @Get('read')
  read(@Req() request: Request): { token: string | null } {
    return { token: this.cookie.read(request) };
  }

  @Get('fail')
  fail(): never {
    throw new InternalServerErrorException('boom');
  }
}

/** Keeps every log line so tests can assert what was (not) logged. */
class RecordingLogger implements LoggerService {
  readonly lines: string[] = [];
  log = (...args: unknown[]) => this.record(args);
  error = (...args: unknown[]) => this.record(args);
  warn = (...args: unknown[]) => this.record(args);
  debug = (...args: unknown[]) => this.record(args);
  verbose = (...args: unknown[]) => this.record(args);
  private record(args: unknown[]): void {
    this.lines.push(args.map((arg) => String(arg)).join(' '));
  }
}

async function startApp(nodeEnv: AppConfig['NODE_ENV']) {
  const logger = new RecordingLogger();
  const moduleRef = await Test.createTestingModule({
    controllers: [TestController],
    providers: [
      SessionCookie,
      { provide: APP_CONFIG, useValue: { NODE_ENV: nodeEnv } },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger });
  app.use(cookieParser());
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  return { app, baseUrl, logger };
}

describe('SessionCookie', () => {
  describe('in production', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      ({ app, baseUrl } = await startApp('production'));
    });

    afterAll(async () => {
      await app.close();
    });

    it('sets a __Host- cookie that is HttpOnly, Secure, Lax, Path=/ and host-only', async () => {
      const response = await fetch(`${baseUrl}/set`);

      expect(response.headers.getSetCookie()).toEqual([
        `${PRODUCTION_SESSION_COOKIE}=${TOKEN}; Path=/; Expires=${EXPIRES_AT.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
      ]);
    });

    it('clears the cookie with the same attributes', async () => {
      const response = await fetch(`${baseUrl}/clear`);

      expect(response.headers.getSetCookie()).toEqual([
        `${PRODUCTION_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`,
      ]);
    });

    it('reads the token from the production cookie name only', async () => {
      const read = (cookie: string) =>
        fetch(`${baseUrl}/read`, { headers: { cookie } }).then((response) =>
          response.json(),
        );

      await expect(
        read(`${PRODUCTION_SESSION_COOKIE}=${TOKEN}; other=1`),
      ).resolves.toEqual({ token: TOKEN });
      await expect(
        read(`${DEVELOPMENT_SESSION_COOKIE}=${TOKEN}`),
      ).resolves.toEqual({ token: null });
    });
  });

  describe('in development', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      ({ app, baseUrl } = await startApp('development'));
    });

    afterAll(async () => {
      await app.close();
    });

    it('sets a plain-named cookie without Secure so it works over http', async () => {
      const response = await fetch(`${baseUrl}/set`);

      expect(response.headers.getSetCookie()).toEqual([
        `${DEVELOPMENT_SESSION_COOKIE}=${TOKEN}; Path=/; Expires=${EXPIRES_AT.toUTCString()}; HttpOnly; SameSite=Lax`,
      ]);
    });

    it('returns null when there is no session cookie', async () => {
      const response = await fetch(`${baseUrl}/read`);

      await expect(response.json()).resolves.toEqual({ token: null });
    });
  });

  it('never puts the token in logs or error responses', async () => {
    const { app, baseUrl, logger } = await startApp('production');
    try {
      const response = await fetch(`${baseUrl}/fail`, {
        headers: { cookie: `${PRODUCTION_SESSION_COOKIE}=${TOKEN}` },
      });

      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(TOKEN);
      // The 500 was logged, without the cookie or its value.
      expect(logger.lines.some((line) => line.includes('/fail'))).toBe(true);
      expect(logger.lines.join('\n')).not.toContain(TOKEN);
    } finally {
      await app.close();
    }
  });
});
