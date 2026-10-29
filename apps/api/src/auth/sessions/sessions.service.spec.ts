import { Test } from '@nestjs/testing';
import { CLOCK, type Clock } from '../../common/clock/clock';
import type { DatabaseConnection } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { sessions, USER_AGENT_MAX_LENGTH } from '../../database/schema';
import { insertUser } from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { hashSessionToken } from './session-token';
import { SessionsRepository } from './sessions.repository';
import {
  SESSION_ABSOLUTE_LIFETIME_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  SessionsService,
} from './sessions.service';

const USER_ID = '00000000-0000-4000-8000-00000000000a';
const SESSION_ID = '00000000-0000-4000-8000-00000000000b';
const NOW = new Date('2026-01-10T12:00:00.000Z');
// A well-formed token: 43 base64url characters.
const TOKEN = 'a'.repeat(43);

class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

function activeRow(lastUsedAt: Date) {
  return {
    id: SESSION_ID,
    lastUsedAt,
    user: {
      id: USER_ID,
      email: 'ana@example.com',
      name: 'Ana',
      emailVerifiedAt: null,
    },
  };
}

describe('SessionsService', () => {
  let service: SessionsService;
  const repository = {
    create: vi.fn(),
    findActiveByTokenHash: vi.fn(),
    touch: vi.fn(),
    deleteByTokenHash: vi.fn(),
    deleteById: vi.fn(),
    deleteAllForUser: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: SessionsRepository, useValue: repository },
        { provide: CLOCK, useValue: new FakeClock(NOW) },
      ],
    }).compile();
    service = moduleRef.get(SessionsService);
  });

  it('creates a session storing only the token hash', async () => {
    repository.create.mockResolvedValue({ id: SESSION_ID });

    const { token, expiresAt } = await service.create(USER_ID, 'Agent');

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt).toEqual(
      new Date(NOW.getTime() + SESSION_ABSOLUTE_LIFETIME_MS),
    );
    expect(repository.create).toHaveBeenCalledWith({
      userId: USER_ID,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastUsedAt: NOW,
      userAgent: 'Agent',
    });
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain(token);
  });

  it('generates a different token for every session', async () => {
    repository.create.mockResolvedValue({ id: SESSION_ID });

    const first = await service.create(USER_ID, null);
    const second = await service.create(USER_ID, null);

    expect(first.token).not.toBe(second.token);
  });

  it('truncates the user agent by characters and stores null when absent', async () => {
    repository.create.mockResolvedValue({ id: SESSION_ID });

    await service.create(USER_ID, '😀'.repeat(USER_AGENT_MAX_LENGTH + 10));
    await service.create(USER_ID, undefined);

    const [[long], [missing]] = repository.create.mock.calls;
    expect(Array.from(long.userAgent as string)).toHaveLength(
      USER_AGENT_MAX_LENGTH,
    );
    expect(long.userAgent).toBe('😀'.repeat(USER_AGENT_MAX_LENGTH));
    expect(missing.userAgent).toBeNull();
  });

  it('looks the session up by hash with the absolute and idle cutoffs', async () => {
    repository.findActiveByTokenHash.mockResolvedValue(activeRow(NOW));

    await service.validate(TOKEN);

    expect(repository.findActiveByTokenHash).toHaveBeenCalledWith(
      hashSessionToken(TOKEN),
      {
        now: NOW,
        idleSince: new Date(NOW.getTime() - SESSION_IDLE_TIMEOUT_MS),
      },
    );
  });

  it('returns the session id and the user without credentials', async () => {
    repository.findActiveByTokenHash.mockResolvedValue(activeRow(NOW));

    await expect(service.validate(TOKEN)).resolves.toEqual({
      id: SESSION_ID,
      user: {
        id: USER_ID,
        email: 'ana@example.com',
        name: 'Ana',
        emailVerified: false,
      },
    });
  });

  it('deletes the row and returns null when the session is not active', async () => {
    repository.findActiveByTokenHash.mockResolvedValue(undefined);

    await expect(service.validate(TOKEN)).resolves.toBeNull();
    expect(repository.deleteByTokenHash).toHaveBeenCalledWith(
      hashSessionToken(TOKEN),
    );
  });

  it('rejects malformed tokens without querying the database', async () => {
    await expect(service.validate('')).resolves.toBeNull();
    await expect(service.validate('not a token')).resolves.toBeNull();
    await expect(service.validate(`${TOKEN}a`)).resolves.toBeNull();
    expect(repository.findActiveByTokenHash).not.toHaveBeenCalled();
  });

  it('does not refresh last_used_at within the touch interval', async () => {
    repository.findActiveByTokenHash.mockResolvedValue(
      activeRow(new Date(NOW.getTime() - SESSION_TOUCH_INTERVAL_MS + 1)),
    );

    await service.validate(TOKEN);

    expect(repository.touch).not.toHaveBeenCalled();
  });

  it('refreshes last_used_at once the touch interval has passed', async () => {
    repository.findActiveByTokenHash.mockResolvedValue(
      activeRow(new Date(NOW.getTime() - SESSION_TOUCH_INTERVAL_MS)),
    );

    await service.validate(TOKEN);

    expect(repository.touch).toHaveBeenCalledWith(SESSION_ID, NOW);
  });

  it('revokes one session or every session of a user', async () => {
    await service.revoke(SESSION_ID);
    await service.revokeAllForUser(USER_ID);

    expect(repository.deleteById).toHaveBeenCalledWith(SESSION_ID);
    expect(repository.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
  });

  it('revokes a session by its raw token through the hash', async () => {
    await service.revokeByToken(TOKEN);

    expect(repository.deleteByTokenHash).toHaveBeenCalledWith(
      hashSessionToken(TOKEN),
    );
  });

  it('ignores a malformed token on revocation', async () => {
    await service.revokeByToken('not a token');

    expect(repository.deleteByTokenHash).not.toHaveBeenCalled();
  });
});

// End to end on PGlite with the real repository: proves expiry is enforced
// by the SQL the service drives, not only by the mocked calls above.
describe('SessionsService with the database', () => {
  let connection: DatabaseConnection;
  let service: SessionsService;
  let clock: FakeClock;

  beforeAll(async () => {
    connection = await createTestDatabase();
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        SessionsRepository,
        { provide: DATABASE, useValue: connection.db },
        { provide: CLOCK, useValue: clock },
      ],
    }).compile();
    service = moduleRef.get(SessionsService);
  });

  async function sessionCount(): Promise<number> {
    return (await connection.db.select().from(sessions)).length;
  }

  it('never stores the raw token', async () => {
    const user = await insertUser(connection.db);

    const { token } = await service.create(user.id, 'Agent');

    const rows = await connection.db.select().from(sessions);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows.map((row) => row.tokenHash)).toContain(hashSessionToken(token));
  });

  it('returns the user for a valid token and null after revocation', async () => {
    const user = await insertUser(connection.db);
    const { token } = await service.create(user.id, null);

    const session = await service.validate(token);
    expect(session?.user.id).toBe(user.id);

    await service.revoke(session?.id ?? '');
    await expect(service.validate(token)).resolves.toBeNull();
  });

  it('returns null for an unknown token', async () => {
    await expect(service.validate('b'.repeat(43))).resolves.toBeNull();
  });

  it('enforces the idle timeout and deletes the idle session', async () => {
    const user = await insertUser(connection.db);
    const { token } = await service.create(user.id, null);
    const before = await sessionCount();

    clock.advance(SESSION_IDLE_TIMEOUT_MS - 1);
    await expect(service.validate(token)).resolves.not.toBeNull();

    // Using it refreshed last_used_at, so another almost-idle week is fine.
    clock.advance(SESSION_IDLE_TIMEOUT_MS - 1);
    await expect(service.validate(token)).resolves.not.toBeNull();

    clock.advance(SESSION_IDLE_TIMEOUT_MS);
    await expect(service.validate(token)).resolves.toBeNull();
    await expect(sessionCount()).resolves.toBe(before - 1);
  });

  it('enforces the absolute lifetime even for an active session', async () => {
    const user = await insertUser(connection.db);
    const { token } = await service.create(user.id, null);
    const before = await sessionCount();

    // Used every day: never idle, but 30 days after sign-in it ends.
    const day = 24 * 60 * 60 * 1000;
    const lifetimeDays = SESSION_ABSOLUTE_LIFETIME_MS / day;
    for (let elapsedDays = 1; elapsedDays < lifetimeDays; elapsedDays++) {
      clock.advance(day);
      await expect(service.validate(token)).resolves.not.toBeNull();
    }
    clock.advance(day);
    await expect(service.validate(token)).resolves.toBeNull();
    await expect(sessionCount()).resolves.toBe(before - 1);
  });

  it("signs a user out everywhere without touching other users' sessions", async () => {
    const user = await insertUser(connection.db);
    const otherUser = await insertUser(connection.db);
    const first = await service.create(user.id, null);
    const second = await service.create(user.id, null);
    const other = await service.create(otherUser.id, null);

    await service.revokeAllForUser(user.id);

    await expect(service.validate(first.token)).resolves.toBeNull();
    await expect(service.validate(second.token)).resolves.toBeNull();
    await expect(service.validate(other.token)).resolves.not.toBeNull();
  });
});
