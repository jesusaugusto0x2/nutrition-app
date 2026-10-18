import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { createDatabase, type DatabaseConnection } from './client';
import { DATABASE, DATABASE_CONNECTION } from './database.tokens';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createDatabase(config.DATABASE_URL),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: DatabaseConnection) => connection.db,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
