import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DevelopmentClinicGuard } from './common/guards/development-clinic.guard';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { NutritionHistoryModule } from './modules/nutrition-history/nutrition-history.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PortalModule } from './modules/portal/portal.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    // Production only: serve the built SPA, falling back to index.html for
    // client-side routes. /api is excluded so unknown API routes return 404.
    ServeStaticModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.NODE_ENV === 'production' && config.WEB_DIST_DIR
          ? [{ rootPath: config.WEB_DIST_DIR, exclude: ['/api/{*path}'] }]
          : [],
    }),
    AuthModule,
    HealthModule,
    ClinicsModule,
    PatientsModule,
    ConsultationsModule,
    NutritionHistoryModule,
    PortalModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // TEMPORARY until real auth: see DevelopmentClinicGuard.
    { provide: APP_GUARD, useClass: DevelopmentClinicGuard },
  ],
})
export class AppModule {}
