import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { CredentialsRepository } from './credentials/credentials.repository';
import { PasswordHasher } from './passwords/password-hasher';
import { SessionsService } from './sessions/sessions.service';

const USER_ID = '00000000-0000-4000-8000-00000000000a';
const PASSWORD = 'correct horse battery staple';

function userRow(passwordHash: string | null) {
  return {
    id: USER_ID,
    email: 'ana@example.com',
    name: 'Ana',
    emailVerifiedAt: null,
    passwordHash,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  const credentials = { findByEmail: vi.fn(), updatePasswordHash: vi.fn() };
  const passwordHasher = {
    hash: vi.fn(),
    verify: vi.fn(),
    needsRehash: vi.fn(),
    verifyDummy: vi.fn(),
  };
  const sessions = { create: vi.fn(), revokeByToken: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CredentialsRepository, useValue: credentials },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: SessionsService, useValue: sessions },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  /** The rejection of a failed sign-in, for comparing failures. */
  async function failure(email: string, password: string) {
    const error: unknown = await service
      .validateCredentials(email, password)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UnauthorizedException);
    return (error as UnauthorizedException).getResponse();
  }

  it('returns the user without credentials for a correct password', async () => {
    credentials.findByEmail.mockResolvedValue(userRow('stored-hash'));
    passwordHasher.verify.mockResolvedValue(true);

    await expect(
      service.validateCredentials('ana@example.com', PASSWORD),
    ).resolves.toEqual({
      id: USER_ID,
      email: 'ana@example.com',
      name: 'Ana',
      emailVerified: false,
    });
    expect(passwordHasher.verify).toHaveBeenCalledWith('stored-hash', PASSWORD);
  });

  it('looks the user up by normalized email', async () => {
    credentials.findByEmail.mockResolvedValue(undefined);

    await failure(' Ana@Example.COM ', PASSWORD);

    expect(credentials.findByEmail).toHaveBeenCalledWith('ana@example.com');
  });

  it('fails identically for a wrong password, an unknown email and a Google-only user', async () => {
    credentials.findByEmail.mockResolvedValueOnce(userRow('stored-hash'));
    passwordHasher.verify.mockResolvedValueOnce(false);
    const wrongPassword = await failure('ana@example.com', 'wrong');

    credentials.findByEmail.mockResolvedValueOnce(undefined);
    const unknownEmail = await failure('nobody@example.com', PASSWORD);

    credentials.findByEmail.mockResolvedValueOnce(userRow(null));
    const googleOnly = await failure('ana@example.com', PASSWORD);

    expect(wrongPassword).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(unknownEmail).toEqual(wrongPassword);
    expect(googleOnly).toEqual(wrongPassword);
  });

  it('verifies against a dummy hash when there is no password to check', async () => {
    credentials.findByEmail.mockResolvedValueOnce(undefined);
    await failure('nobody@example.com', PASSWORD);
    credentials.findByEmail.mockResolvedValueOnce(userRow(null));
    await failure('ana@example.com', PASSWORD);

    expect(passwordHasher.verifyDummy).toHaveBeenCalledTimes(2);
    expect(passwordHasher.verifyDummy).toHaveBeenCalledWith(PASSWORD);
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('rehashes the password when the stored hash is outdated', async () => {
    credentials.findByEmail.mockResolvedValue(userRow('old-hash'));
    passwordHasher.verify.mockResolvedValue(true);
    passwordHasher.needsRehash.mockReturnValue(true);
    passwordHasher.hash.mockResolvedValue('new-hash');

    await service.validateCredentials('ana@example.com', PASSWORD);

    expect(passwordHasher.hash).toHaveBeenCalledWith(PASSWORD);
    expect(credentials.updatePasswordHash).toHaveBeenCalledWith(
      USER_ID,
      'new-hash',
    );
  });

  it('does not rehash a current hash or after a wrong password', async () => {
    credentials.findByEmail.mockResolvedValue(userRow('stored-hash'));
    passwordHasher.needsRehash.mockReturnValue(true);
    passwordHasher.verify.mockResolvedValueOnce(false);
    await failure('ana@example.com', 'wrong');

    passwordHasher.needsRehash.mockReturnValue(false);
    passwordHasher.verify.mockResolvedValueOnce(true);
    await service.validateCredentials('ana@example.com', PASSWORD);

    expect(credentials.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('revokes the presented session and creates a new one', async () => {
    const created = { token: 'new-token', expiresAt: new Date() };
    sessions.create.mockResolvedValue(created);

    await expect(
      service.startSession(USER_ID, 'old-token', 'Agent'),
    ).resolves.toBe(created);

    expect(sessions.revokeByToken).toHaveBeenCalledWith('old-token');
    expect(sessions.create).toHaveBeenCalledWith(USER_ID, 'Agent');
  });

  it('creates a session without revoking anything when there is no cookie', async () => {
    await service.startSession(USER_ID, null, undefined);

    expect(sessions.revokeByToken).not.toHaveBeenCalled();
    expect(sessions.create).toHaveBeenCalledWith(USER_ID, undefined);
  });

  it('revokes the current session on sign-out, if there is one', async () => {
    await service.signOut('token');
    await service.signOut(null);

    expect(sessions.revokeByToken).toHaveBeenCalledTimes(1);
    expect(sessions.revokeByToken).toHaveBeenCalledWith('token');
  });
});
