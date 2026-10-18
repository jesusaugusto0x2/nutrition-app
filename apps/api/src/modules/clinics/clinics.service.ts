import { Injectable } from '@nestjs/common';
import { ClinicsRepository } from './clinics.repository';

@Injectable()
export class ClinicsService {
  constructor(private readonly clinicsRepository: ClinicsRepository) {}

  exists(clinicId: string): Promise<boolean> {
    return this.clinicsRepository.exists(clinicId);
  }
}
