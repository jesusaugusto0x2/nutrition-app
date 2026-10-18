import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { DATABASE } from '../database/database.tokens';

@Injectable()
export class HealthRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }
}
