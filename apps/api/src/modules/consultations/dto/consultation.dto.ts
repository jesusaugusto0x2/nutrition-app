import {
  consultationSchema,
  createConsultationSchema,
  idSchema,
} from '@nutri/schemas';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ConsultationDto extends createZodDto(consultationSchema) {}

export class CreateConsultationDto extends createZodDto(
  createConsultationSchema,
) {}

export class ConsultationsParamsDto extends createZodDto(
  z.object({ patientId: idSchema }),
) {}
