import { loadMigrationConfig } from './migration-config';

const url = 'postgresql://owner:secret-password@db.example.com/db';

describe('loadMigrationConfig', () => {
  it('reads DATABASE_MIGRATION_URL', () => {
    expect(loadMigrationConfig({ DATABASE_MIGRATION_URL: url })).toEqual({
      NODE_ENV: 'development',
      DATABASE_MIGRATION_URL: url,
    });
  });

  it('does not fall back to DATABASE_URL', () => {
    expect(() =>
      loadMigrationConfig({ DATABASE_URL: `${url}?sslmode=verify-full` }),
    ).toThrow(/DATABASE_MIGRATION_URL/);
  });

  it('rejects a non-postgres URL without echoing it', () => {
    let message = '';
    try {
      loadMigrationConfig({
        DATABASE_MIGRATION_URL: 'mysql://owner:secret-password@db/db',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/DATABASE_MIGRATION_URL/);
    expect(message).not.toMatch(/secret-password/);
  });

  it('accepts a URL without sslmode outside production', () => {
    expect(
      loadMigrationConfig({ DATABASE_MIGRATION_URL: url })
        .DATABASE_MIGRATION_URL,
    ).toBe(url);
  });

  describe('in production', () => {
    it.each(['?sslmode=verify-full', '?sslmode=disable'])(
      'accepts %s',
      (query) => {
        expect(
          loadMigrationConfig({
            NODE_ENV: 'production',
            DATABASE_MIGRATION_URL: `${url}${query}`,
          }).DATABASE_MIGRATION_URL,
        ).toBe(`${url}${query}`);
      },
    );

    it.each(['', '?sslmode=require', '?sslmode=prefer', '?sslmode=no-verify'])(
      'rejects %j instead of sslmode=verify-full',
      (query) => {
        let message = '';
        try {
          loadMigrationConfig({
            NODE_ENV: 'production',
            DATABASE_MIGRATION_URL: `${url}${query}`,
          });
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).toMatch(
          /DATABASE_MIGRATION_URL: Must set sslmode=verify-full/,
        );
        expect(message).not.toMatch(/secret-password/);
      },
    );
  });
});
