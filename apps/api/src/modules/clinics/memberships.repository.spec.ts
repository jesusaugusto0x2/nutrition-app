import type { DatabaseConnection } from '../../database/client';
import {
  insertClinic,
  insertMembership,
  insertUser,
} from '../../database/testing/fixtures';
import { createTestDatabase } from '../../database/testing/test-database';
import { MembershipsRepository } from './memberships.repository';

describe('MembershipsRepository', () => {
  let connection: DatabaseConnection;
  let repository: MembershipsRepository;

  beforeAll(async () => {
    connection = await createTestDatabase();
    repository = new MembershipsRepository(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('creates a membership with the given role', async () => {
    const clinic = await insertClinic(connection.db, 'New clinic');
    const user = await insertUser(connection.db);

    await repository.create({
      userId: user.id,
      clinicId: clinic.id,
      role: 'owner',
    });

    await expect(repository.findAllByUser(user.id)).resolves.toEqual([
      { clinicId: clinic.id, clinicName: 'New clinic', role: 'owner' },
    ]);
  });

  it('writes through the transaction it receives', async () => {
    const clinic = await insertClinic(connection.db);
    const user = await insertUser(connection.db);

    await expect(
      connection.db.transaction(async (tx) => {
        await repository.create(
          { userId: user.id, clinicId: clinic.id, role: 'owner' },
          tx,
        );
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    await expect(repository.findAllByUser(user.id)).resolves.toEqual([]);
  });

  it("finds the clinic of the user's membership", async () => {
    const clinic = await insertClinic(connection.db);
    const user = await insertUser(connection.db);
    await insertMembership(connection.db, user.id, clinic.id);

    await expect(repository.findFirstClinicIdByUser(user.id)).resolves.toBe(
      clinic.id,
    );
  });

  it('finds nothing for a user without a membership', async () => {
    const clinic = await insertClinic(connection.db);
    const member = await insertUser(connection.db);
    await insertMembership(connection.db, member.id, clinic.id);
    const other = await insertUser(connection.db);

    await expect(
      repository.findFirstClinicIdByUser(other.id),
    ).resolves.toBeNull();
  });

  it('returns the oldest membership of a user with several', async () => {
    const first = await insertClinic(connection.db);
    const second = await insertClinic(connection.db);
    const user = await insertUser(connection.db);
    await insertMembership(connection.db, user.id, second.id, {
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await insertMembership(connection.db, user.id, first.id, {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(repository.findFirstClinicIdByUser(user.id)).resolves.toBe(
      first.id,
    );
  });

  it("lists the user's clinics with name and role, oldest first", async () => {
    const first = await insertClinic(connection.db, 'First clinic');
    const second = await insertClinic(connection.db, 'Second clinic');
    const user = await insertUser(connection.db);
    await insertMembership(connection.db, user.id, second.id, {
      role: 'assistant',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await insertMembership(connection.db, user.id, first.id, {
      role: 'nutritionist',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(repository.findAllByUser(user.id)).resolves.toEqual([
      {
        clinicId: first.id,
        clinicName: 'First clinic',
        role: 'nutritionist',
      },
      {
        clinicId: second.id,
        clinicName: 'Second clinic',
        role: 'assistant',
      },
    ]);
  });

  it("does not list another user's clinics", async () => {
    const clinic = await insertClinic(connection.db);
    const member = await insertUser(connection.db);
    await insertMembership(connection.db, member.id, clinic.id);
    const other = await insertUser(connection.db);

    await expect(repository.findAllByUser(other.id)).resolves.toEqual([]);
  });
});
