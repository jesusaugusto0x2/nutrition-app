import { Injectable } from '@nestjs/common';
import type { Consultation, CreateConsultationInput } from '@nutri/schemas';
import { PatientsService } from '../patients/patients.service';
import { toConsultation } from './consultations.mapper';
import { ConsultationsRepository } from './consultations.repository';

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly consultationsRepository: ConsultationsRepository,
    // Cross-module access goes through the exported service, never through
    // PatientsRepository.
    private readonly patientsService: PatientsService,
  ) {}

  async listByPatient(
    clinicId: string,
    patientId: string,
  ): Promise<Consultation[]> {
    await this.patientsService.assertExists(clinicId, patientId);
    const rows = await this.consultationsRepository.findByPatient(
      clinicId,
      patientId,
    );
    return rows.map(toConsultation);
  }

  async create(
    clinicId: string,
    patientId: string,
    input: CreateConsultationInput,
  ): Promise<Consultation> {
    await this.patientsService.assertExists(clinicId, patientId);
    const row = await this.consultationsRepository.create(
      clinicId,
      patientId,
      input,
    );
    return toConsultation(row);
  }
}
