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
      WEB_DIST_DIR: '/web',
      SMTP_URL: 'smtps://resend:secret-api-key@smtp.resend.com:465',
      MAIL_FROM: 'Mi consulta <no-reply@example.com>',
      APP_ORIGIN: 'https://app.example.com',
    };

    it('accepts a complete environment without applying defaults', () => {
      expect(loadConfig(productionEnv)).toMatchObject({
        WEB_DIST_DIR: '/web',
        SMTP_URL: productionEnv.SMTP_URL,
        MAIL_FROM: productionEnv.MAIL_FROM,
        APP_ORIGIN: productionEnv.APP_ORIGIN,
      });
    });

    it.each(['WEB_DIST_DIR', 'SMTP_URL', 'MAIL_FROM', 'APP_ORIGIN'])(
      'requires %s',
      (key) => {
        expect(() =>
          loadConfig({ ...productionEnv, [key]: undefined }),
        ).toThrow(new RegExp(`${key}: Required in production`));
      },
    );
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
