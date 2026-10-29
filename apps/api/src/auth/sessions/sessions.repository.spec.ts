import { eq } from 'drizzle-orm';
import type { DatabaseConnection } from '../../database/client';
import { sessions } from '../../database/schema';
import { insertSession, insertUser } from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { SessionsRepository } from './sessions.repository';

const cutoffs = {
  now: new Date('2026-01-10T00:00:00.000Z'),
  idleSince: new Date('2026-01-03T00:00:00.000Z'),
};

describe('SessionsRepository', () => {
  let connection: DatabaseConnection;
  let repository: SessionsRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new SessionsRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('finds an active session with its user by token hash', async () => {
    const user = await insertUser(connection.db, {
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const session = await insertSession(connection.db, user.id, {
      tokenHash: 'hash-valid',
      lastUsedAt: new Date('2026-01-09T00:00:00.000Z'),
    });

    await expect(
      repository.findActiveByTokenHash('hash-valid', cutoffs),
    ).resolves.toEqual({
      id: session.id,
      lastUsedAt: session.lastUsedAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  });

  it('does not return a session past its absolute expiry', async () => {
    const user = await insertUser(connection.db);
    await insertSession(connection.db, user.id, {
      tokenHash: 'hash-expired',
      expiresAt: cutoffs.now,
      lastUsedAt: new Date('2026-01-09T00:00:00.000Z'),
    });

    await expect(
      repository.findActiveByTokenHash('hash-expired', cutoffs),
    ).resolves.toBeUndefined();
  });

  it('does not return a session idle since before the cutoff', async () => {
    const user = await insertUser(connection.db);
    await insertSession(connection.db, user.id, {
      tokenHash: 'hash-idle',
      lastUsedAt: cutoffs.idleSince,
    });

    await expect(
      repository.findActiveByTokenHash('hash-idle', cutoffs),
    ).resolves.toBeUndefined();
  });

  it('does not return a revoked session', async () => {
    const user = await insertUser(connection.db);
    const session = await insertSession(connection.db, user.id, {
      tokenHash: 'hash-revoked',
      lastUsedAt: new Date('2026-01-09T00:00:00.000Z'),
    });

    await repository.deleteById(session.id);

    await expect(
      repository.findActiveByTokenHash('hash-revoked', cutoffs),
    ).resolves.toBeUndefined();
  });

  it('does not return anything for an unknown token hash', async () => {
    await expect(
      repository.findActiveByTokenHash('hash-unknown', cutoffs),
    ).resolves.toBeUndefined();
  });

  it('creates a session and returns its id', async () => {
    const user = await insertUser(connection.db);

    const { id } = await repository.create({
      userId: user.id,
      tokenHash: 'hash-created',
      expiresAt: new Date('2026-02-09T00:00:00.000Z'),
      lastUsedAt: cutoffs.now,
      userAgent: 'Test agent',
    });

    const [row] = await connection.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));
    expect(row).toMatchObject({
      userId: user.id,
      tokenHash: 'hash-created',
      userAgent: 'Test agent',
    });
  });

  it('updates last_used_at on touch', async () => {
    const user = await insertUser(connection.db);
    const session = await insertSession(connection.db, user.id);

    await repository.touch(session.id, cutoffs.now);

    const [row] = await connection.db
      .select({ lastUsedAt: sessions.lastUsedAt })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(row.lastUsedAt).toEqual(cutoffs.now);
  });

  it('deletes a session by token hash', async () => {
    const user = await insertUser(connection.db);
    const session = await insertSession(connection.db, user.id, {
      tokenHash: 'hash-to-delete',
    });

    await repository.deleteByTokenHash('hash-to-delete');

    const rows = await connection.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(rows).toHaveLength(0);
  });

  it("deletes every session of a user and nobody else's", async () => {
    const user = await insertUser(connection.db);
    const otherUser = await insertUser(connection.db);
    await insertSession(connection.db, user.id);
    await insertSession(connection.db, user.id);
    const otherSession = await insertSession(connection.db, otherUser.id);

    await repository.deleteAllForUser(user.id);

    const remaining = await connection.db
      .select({ id: sessions.id, userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(remaining).toHaveLength(0);
    const others = await connection.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, otherUser.id));
    expect(others).toEqual([{ id: otherSession.id }]);
  });
});
