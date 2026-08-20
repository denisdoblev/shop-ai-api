import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const configService = app.get(ConfigService);

  const title = configService.get<string>('SWAGGER_TITLE' as string) as string;
  const description = configService.get<string>(
    'SWAGGER_DESCRIPTION' as string,
  ) as string;
  const version = configService.get<string>(
    'SWAGGER_VERSION' as string,
  ) as string;

  const config = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);
}
