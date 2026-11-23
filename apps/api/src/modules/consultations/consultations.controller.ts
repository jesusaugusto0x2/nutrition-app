import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { ClinicAccess } from '../../common/decorators/clinic-access.decorator';
import { CurrentClinic } from '../../common/decorators/current-clinic.decorator';
import { ConsultationsService } from './consultations.service';
import {
  ConsultationDto,
  ConsultationParamsDto,
  ConsultationsParamsDto,
  CreateConsultationDto,
  UpdateConsultationDto,
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

  @Patch(':consultationId')
  @ZodSerializerDto(ConsultationDto)
  update(
    @CurrentClinic() clinicId: string,
    @Param() { patientId, consultationId }: ConsultationParamsDto,
    @Body() body: UpdateConsultationDto,
  ) {
    return this.consultationsService.update(
      clinicId,
      patientId,
      consultationId,
      body,
    );
  }

  @Delete(':consultationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @CurrentClinic() clinicId: string,
    @Param() { patientId, consultationId }: ConsultationParamsDto,
  ) {
    await this.consultationsService.softDelete(
      clinicId,
      patientId,
      consultationId,
    );
  }
}
