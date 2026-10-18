import {
  createPatientSchema,
  idSchema,
  patientSchema,
  updatePatientSchema,
} from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class PatientDto extends createZodDto(patientSchema) {}

export class CreatePatientDto extends createZodDto(createPatientSchema) {}

export class UpdatePatientDto extends createZodDto(updatePatientSchema) {}

export class PatientParamsDto extends createZodDto(
  z.object({ patientId: idSchema }),
) {}
