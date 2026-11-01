import { Inject, Injectable } from '@nestjs/common';
import type { Database } from './client';
import { DATABASE } from './database.tokens';

/** The handle of an open transaction; pass it to every step that joins it. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Opens a transaction for writes that span modules, so services coordinate
 * them without touching the database (see docs/architecture.md).
 */
@Injectable()
export class TransactionRunner {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Commits when `work` resolves and rolls back when it rejects. */
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
