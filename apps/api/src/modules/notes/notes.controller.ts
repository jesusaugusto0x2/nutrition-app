import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '@nutri/schemas';
import { ZodSerializerDto } from 'nestjs-zod';
import { ClinicAccess } from '../../common/decorators/clinic-access.decorator';
import { CurrentClinic } from '../../common/decorators/current-clinic.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotesService } from './notes.service';
import {
  CreateNoteDto,
  NoteDto,
  NoteParamsDto,
  NotesParamsDto,
} from './dto/note.dto';

@ClinicAccess()
@Controller('clinic/patients/:patientId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ZodSerializerDto([NoteDto])
  list(
    @CurrentClinic() clinicId: string,
    @Param() { patientId }: NotesParamsDto,
  ) {
    return this.notesService.listByPatient(clinicId, patientId);
  }

  @Post()
  @ZodSerializerDto(NoteDto)
  create(
    @CurrentClinic() clinicId: string,
    @CurrentUser() user: AuthUser,
    @Param() { patientId }: NotesParamsDto,
    @Body() body: CreateNoteDto,
  ) {
    return this.notesService.create(clinicId, patientId, user.id, body);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @CurrentClinic() clinicId: string,
    @Param() { patientId, noteId }: NoteParamsDto,
  ) {
    await this.notesService.softDelete(clinicId, patientId, noteId);
  }
}
