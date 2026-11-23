import {
  consultationSchema,
  createConsultationSchema,
  idSchema,
  updateConsultationSchema,
} from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ConsultationDto extends createZodDto(consultationSchema) {}

export class CreateConsultationDto extends createZodDto(
  createConsultationSchema,
) {}

export class UpdateConsultationDto extends createZodDto(
  updateConsultationSchema,
) {}

export class ConsultationsParamsDto extends createZodDto(
  z.object({ patientId: idSchema }),
) {}

export class ConsultationParamsDto extends createZodDto(
  z.object({ patientId: idSchema, consultationId: idSchema }),
) {}
