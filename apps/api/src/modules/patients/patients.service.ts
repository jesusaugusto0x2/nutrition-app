import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePatientInput,
  Patient,
  UpdatePatientInput,
} from '@nutri/schemas';
import { toPatient } from './patients.mapper';
import { PatientsRepository } from './patients.repository';

@Injectable()
export class PatientsService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  async list(clinicId: string): Promise<Patient[]> {
    const rows = await this.patientsRepository.findAll(clinicId);
    return rows.map(toPatient);
  }

  async getById(clinicId: string, patientId: string): Promise<Patient> {
    const row = await this.patientsRepository.findById(clinicId, patientId);
    if (!row) {
      throw patientNotFound();
    }
    return toPatient(row);
  }

  async create(clinicId: string, input: CreatePatientInput): Promise<Patient> {
    return toPatient(await this.patientsRepository.create(clinicId, input));
  }

  async update(
    clinicId: string,
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<Patient> {
    const row = await this.patientsRepository.update(
      clinicId,
      patientId,
      input,
    );
    if (!row) {
      throw patientNotFound();
    }
    return toPatient(row);
  }

  /**
   * For other modules: throws NotFoundException unless the patient exists, is
   * not deleted and belongs to the clinic.
   */
  async assertExists(clinicId: string, patientId: string): Promise<void> {
    const row = await this.patientsRepository.findById(clinicId, patientId);
    if (!row) {
      throw patientNotFound();
    }
  }
}

// Same response whether the patient does not exist or belongs to another
// clinic, so ids from other clinics cannot be probed.
function patientNotFound(): NotFoundException {
  return new NotFoundException('Patient not found');
}
