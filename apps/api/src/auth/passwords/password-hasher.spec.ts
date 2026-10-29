import * as argon2 from 'argon2';
import { PASSWORD_HASH_OPTIONS } from './password-hash-options';
import { PasswordHasher } from './password-hasher';

const PASSWORD = 'correct horse battery staple';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with argon2id and the configured parameters', async () => {
    const hash = await hasher.hash(PASSWORD);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(hash).not.toContain(PASSWORD);
  });

  it('uses a new salt for every hash', async () => {
    await expect(hasher.hash(PASSWORD)).resolves.not.toBe(
      await hasher.hash(PASSWORD),
    );
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash(PASSWORD);

    await expect(hasher.verify(hash, PASSWORD)).resolves.toBe(true);
    await expect(hasher.verify(hash, `${PASSWORD}!`)).resolves.toBe(false);
  });

  it('verifies a password typed with another Unicode composition', async () => {
    const composed = 'contraseña de mañana';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed);

    const hash = await hasher.hash(decomposed);

    await expect(hasher.verify(hash, composed)).resolves.toBe(true);
  });

  it('does not need a rehash for a hash with the current parameters', async () => {
    expect(hasher.needsRehash(await hasher.hash(PASSWORD))).toBe(false);
  });

  it('needs a rehash for weaker parameters', async () => {
    const weaker = await argon2.hash(PASSWORD, {
      ...PASSWORD_HASH_OPTIONS,
      memoryCost: 9216,
    });

    expect(hasher.needsRehash(weaker)).toBe(true);
  });

  it('needs a rehash for another argon2 variant', async () => {
    const argon2i = await argon2.hash(PASSWORD, {
      ...PASSWORD_HASH_OPTIONS,
      type: argon2.argon2i,
    });

    expect(hasher.needsRehash(argon2i)).toBe(true);
  });

  it('always fails the dummy verification, even after startup', async () => {
    await hasher.onModuleInit();

    await expect(hasher.verifyDummy(PASSWORD)).resolves.toBe(false);
    await expect(hasher.verifyDummy('')).resolves.toBe(false);
  });
});
