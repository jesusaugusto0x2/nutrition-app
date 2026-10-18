import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { ClinicAccess } from '../../common/decorators/clinic-access.decorator';
import { CurrentClinic } from '../../common/decorators/current-clinic.decorator';
import { ConsultationsService } from './consultations.service';
import {
  ConsultationDto,
  ConsultationsParamsDto,
  CreateConsultationDto,
} from './dto/consultation.dto';

@ClinicAccess()
@Controller('clinic/patients/:patientId/consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Get()
  @ZodSerializerDto([ConsultationDto])
  list(
    @CurrentClinic() clinicId: string,
    @Param() { patientId }: ConsultationsParamsDto,
  ) {
    return this.consultationsService.listByPatient(clinicId, patientId);
  }

  @Post()
  @ZodSerializerDto(ConsultationDto)
  create(
    @CurrentClinic() clinicId: string,
    @Param() { patientId }: ConsultationsParamsDto,
    @Body() body: CreateConsultationDto,
  ) {
    return this.consultationsService.create(clinicId, patientId, body);
  }
}
