import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Consultation,
  CreateConsultationInput,
  UpdateConsultationInput,
} from '@nutri/schemas';
import { CLOCK, type Clock } from '../../common/clock/clock';
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
    @Inject(CLOCK) private readonly clock: Clock,
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

  async update(
    clinicId: string,
    patientId: string,
    consultationId: string,
    input: UpdateConsultationInput,
  ): Promise<Consultation> {
    await this.patientsService.assertExists(clinicId, patientId);
    const row = await this.consultationsRepository.update(
      clinicId,
      patientId,
      consultationId,
      input,
    );
    if (!row) {
      throw consultationNotFound();
    }
    return toConsultation(row);
  }

  async softDelete(
    clinicId: string,
    patientId: string,
    consultationId: string,
  ): Promise<void> {
    await this.patientsService.assertExists(clinicId, patientId);
    const row = await this.consultationsRepository.softDelete(
      clinicId,
      patientId,
      consultationId,
      this.clock.now(),
    );
    if (!row) {
      throw consultationNotFound();
    }
  }
}

// Same response whether the consultation does not exist, is soft-deleted or
// belongs to another clinic, so ids from other clinics cannot be probed.
function consultationNotFound(): NotFoundException {
  return new NotFoundException('Consultation not found');
}
