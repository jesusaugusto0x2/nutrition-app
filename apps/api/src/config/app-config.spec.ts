import { loadConfig } from './app-config';

const validEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://user:secret-password@localhost:5432/db',
};

describe('loadConfig', () => {
  it('parses a valid environment and applies defaults', () => {
    expect(loadConfig(validEnv)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validEnv.DATABASE_URL,
      SMTP_URL: 'smtp://localhost:1025',
      MAIL_FROM: 'Mi consulta <no-reply@localhost>',
      APP_ORIGIN: 'http://localhost:4200',
      CLIENT_IP_SOURCE: 'socket',
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadConfig({ ...validEnv, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names missing variables', () => {
    expect(() => loadConfig({ NODE_ENV: 'development' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() =>
      loadConfig({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('never includes values in the error message', () => {
    let message = '';
    try {
      loadConfig({ ...validEnv, DATABASE_URL: 'not a url secret-password' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toMatch(/secret-password/);
  });

  describe('in production', () => {
    const productionEnv = {
      ...validEnv,
      NODE_ENV: 'production',
      DATABASE_URL:
        'postgresql://app:secret-password@db.example.com/db?sslmode=verify-full',
      WEB_DIST_DIR: '/web',
      SMTP_URL: 'smtps://resend:secret-api-key@smtp.resend.com:465',
      MAIL_FROM: 'Mi consulta <no-reply@example.com>',
      APP_ORIGIN: 'https://app.example.com',
      CLIENT_IP_SOURCE: 'x-real-ip',
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'secret-client-secret',
    };

    it('accepts a complete environment without applying defaults', () => {
      expect(loadConfig(productionEnv)).toMatchObject({
        WEB_DIST_DIR: '/web',
        SMTP_URL: productionEnv.SMTP_URL,
        MAIL_FROM: productionEnv.MAIL_FROM,
        APP_ORIGIN: productionEnv.APP_ORIGIN,
        CLIENT_IP_SOURCE: 'x-real-ip',
      });
    });

    it.each([
      'WEB_DIST_DIR',
      'SMTP_URL',
      'MAIL_FROM',
      'APP_ORIGIN',
      'CLIENT_IP_SOURCE',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
    ])('requires %s', (key) => {
      expect(() => loadConfig({ ...productionEnv, [key]: undefined })).toThrow(
        new RegExp(`${key}: Required in production`),
      );
    });

    it.each(['', '?sslmode=require', '?sslmode=prefer', '?sslmode=no-verify'])(
      'rejects a DATABASE_URL with %j instead of sslmode=verify-full',
      (query) => {
        const url = `postgresql://app:secret-password@db.example.com/db${query}`;
        let message = '';
        try {
          loadConfig({ ...productionEnv, DATABASE_URL: url });
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).toMatch(/DATABASE_URL: Must set sslmode=verify-full/);
        expect(message).not.toMatch(/secret-password/);
      },
    );

    it('accepts sslmode=disable, used by the CI smoke test', () => {
      const url = 'postgres://ci:ci@localhost:5432/db?sslmode=disable';

      expect(
        loadConfig({ ...productionEnv, DATABASE_URL: url }).DATABASE_URL,
      ).toBe(url);
    });
  });

  it('accepts a DATABASE_URL without sslmode outside production', () => {
    expect(loadConfig(validEnv).DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('rejects an SMTP_URL that is not smtp or smtps without echoing it', () => {
    let message = '';
    try {
      loadConfig({ ...validEnv, SMTP_URL: 'https://user:secret-key@mail' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SMTP_URL/);
    expect(message).not.toMatch(/secret-key/);
  });

  describe('Google credentials', () => {
    it('are optional outside production', () => {
      const config = loadConfig(validEnv);

      expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
      expect(config.GOOGLE_CLIENT_SECRET).toBeUndefined();
    });

    it('are read when both are set', () => {
      expect(
        loadConfig({
          ...validEnv,
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
        }),
      ).toMatchObject({
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
      });
    });

    it.each([
      ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      ['GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID'],
    ])('reject %s without %s', (present, missing) => {
      expect(() =>
        loadConfig({ ...validEnv, [present]: 'secret-value' }),
      ).toThrow(new RegExp(missing));
    });

    it('never appear in the error message', () => {
      let message = '';
      try {
        loadConfig({ ...validEnv, GOOGLE_CLIENT_SECRET: 'secret-value' });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toMatch(/secret-value/);
    });
  });

  it('rejects an unknown CLIENT_IP_SOURCE', () => {
    expect(() =>
      loadConfig({ ...validEnv, CLIENT_IP_SOURCE: 'x-forwarded-for' }),
    ).toThrow(/CLIENT_IP_SOURCE/);
  });

  it('rejects an APP_ORIGIN with a path or trailing slash', () => {
    expect(() =>
      loadConfig({ ...validEnv, APP_ORIGIN: 'https://app.example.com/' }),
    ).toThrow(/APP_ORIGIN/);
    expect(() =>
      loadConfig({ ...validEnv, APP_ORIGIN: 'https://app.example.com/app' }),
    ).toThrow(/APP_ORIGIN/);
    expect(
      loadConfig({ ...validEnv, APP_ORIGIN: 'http://localhost:4200' })
        .APP_ORIGIN,
    ).toBe('http://localhost:4200');
  });
});
