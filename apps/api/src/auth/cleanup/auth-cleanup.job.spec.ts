import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CLOCK } from '../../common/clock/clock';
import { SessionsService } from '../sessions/sessions.service';
import { AuthTokensRepository } from '../tokens/auth-tokens.repository';
import { AuthCleanupJob } from './auth-cleanup.job';

const NOW = new Date('2026-01-10T03:00:00.000Z');

describe('AuthCleanupJob', () => {
  let job: AuthCleanupJob;
  const sessions = { deleteInactive: vi.fn() };
  const tokens = { deleteExpiredOrUsed: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthCleanupJob,
        { provide: SessionsService, useValue: sessions },
        { provide: AuthTokensRepository, useValue: tokens },
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile();
    job = moduleRef.get(AuthCleanupJob);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes unusable sessions and tokens and logs only the counts', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    sessions.deleteInactive.mockResolvedValue(2);
    tokens.deleteExpiredOrUsed.mockResolvedValue(3);

    await job.run();

    expect(tokens.deleteExpiredOrUsed).toHaveBeenCalledWith(NOW);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Deleted 2 sessions and 3 one-time tokens',
    );
  });

  it('logs a failure without the error message and does not throw', async () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    sessions.deleteInactive.mockRejectedValue(
      new TypeError('Failed query: params: ana@example.com'),
    );

    await expect(job.run()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledExactlyOnceWith(
      'Could not clean up auth data (TypeError)',
    );
  });
});
