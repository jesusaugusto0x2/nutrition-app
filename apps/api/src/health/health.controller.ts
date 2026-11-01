import { Controller, Get } from '@nestjs/common';
import { healthSchema } from '@nutri/schemas';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

class HealthDto extends createZodDto(healthSchema) {}

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ZodSerializerDto(HealthDto)
  check() {
    return this.healthService.check();
  }
}
