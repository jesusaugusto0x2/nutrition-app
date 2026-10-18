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

  it('requires WEB_DIST_DIR in production', () => {
    expect(() => loadConfig({ ...validEnv, NODE_ENV: 'production' })).toThrow(
      /WEB_DIST_DIR/,
    );
    expect(
      loadConfig({ ...validEnv, NODE_ENV: 'production', WEB_DIST_DIR: '/web' })
        .WEB_DIST_DIR,
    ).toBe('/web');
  });
});
