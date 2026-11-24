import {
  createPatientSchema,
  idSchema,
  patientListItemSchema,
  patientListQuerySchema,
  patientSchema,
  updatePatientSchema,
} from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class PatientDto extends createZodDto(patientSchema) {}

export class PatientListItemDto extends createZodDto(patientListItemSchema) {}

export class PatientListQueryDto extends createZodDto(patientListQuerySchema) {}

export class CreatePatientDto extends createZodDto(createPatientSchema) {}

export class UpdatePatientDto extends createZodDto(updatePatientSchema) {}

export class PatientParamsDto extends createZodDto(
  z.object({ patientId: idSchema }),
) {}
