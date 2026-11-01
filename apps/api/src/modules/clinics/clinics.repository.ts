import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/client';
import { DATABASE } from '../../database/database.tokens';
import { clinics } from '../../database/schema';
import type { Transaction } from '../../database/transaction-runner';

@Injectable()
export class ClinicsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Returns the id of the new clinic. */
  async create(name: string, tx?: Transaction): Promise<string> {
    const [clinic] = await (tx ?? this.db)
      .insert(clinics)
      .values({ name })
      .returning({ id: clinics.id });
    return clinic.id;
  }
}
