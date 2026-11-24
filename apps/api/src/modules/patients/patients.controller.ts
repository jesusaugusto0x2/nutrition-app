import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { ClinicAccess } from '../../common/decorators/clinic-access.decorator';
import { CurrentClinic } from '../../common/decorators/current-clinic.decorator';
import {
  CreatePatientDto,
  PatientDto,
  PatientListItemDto,
  PatientListQueryDto,
  PatientParamsDto,
  UpdatePatientDto,
} from './dto/patient.dto';
import { PatientsService } from './patients.service';

@ClinicAccess()
@Controller('clinic/patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ZodSerializerDto([PatientListItemDto])
  list(@CurrentClinic() clinicId: string, @Query() query: PatientListQueryDto) {
    return this.patientsService.list(clinicId, query);
  }

  @Get(':patientId')
  @ZodSerializerDto(PatientDto)
  getById(
    @CurrentClinic() clinicId: string,
    @Param() { patientId }: PatientParamsDto,
  ) {
    return this.patientsService.getById(clinicId, patientId);
  }

  @Post()
  @ZodSerializerDto(PatientDto)
  create(@CurrentClinic() clinicId: string, @Body() body: CreatePatientDto) {
    return this.patientsService.create(clinicId, body);
  }

  @Patch(':patientId')
  @ZodSerializerDto(PatientDto)
  update(
    @CurrentClinic() clinicId: string,
    @Param() { patientId }: PatientParamsDto,
    @Body() body: UpdatePatientDto,
  ) {
    return this.patientsService.update(clinicId, patientId, body);
  }
}
