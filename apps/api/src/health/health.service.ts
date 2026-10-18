import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Health } from '@nutri/schemas';
import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async check(): Promise<Health> {
    if (!(await this.healthRepository.ping())) {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok', database: 'up' };
  }
}
