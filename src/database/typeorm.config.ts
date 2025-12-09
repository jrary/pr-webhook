import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'mariadb',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 3306),
  username: configService.get<string>('DB_USERNAME', 'root'),
  password: configService.get<string>('DB_PASSWORD', 'rootpassword'),
  database: configService.get<string>('DB_DATABASE', 'rag_chat'),
  synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
  autoLoadEntities: false,
  entities: [
    __dirname + '/../notion/entities/*.entity{.ts,.js}',
    __dirname + '/../github/entities/*.entity{.ts,.js}',
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: false,
  logging: configService.get<string>('NODE_ENV') === 'development',
});
