import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const typeOrmConfigFactory = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  autoLoadEntities: true,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  migrations: [__dirname + '/../../db/migrations/*{.ts,.js}'],
  logging:
    configService.get<string>('NODE_ENV') === 'development'
      ? ['error', 'warn']
      : ['error'],
});
