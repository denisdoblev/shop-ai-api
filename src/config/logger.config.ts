import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';

export const loggerConfigFactory = (configService: ConfigService): Params => {
  const nodeEnv = configService.get<string>('NODE_ENV');

  return {
    pinoHttp: {
      level: nodeEnv === 'production' ? 'info' : 'debug',
      transport:
        nodeEnv !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                levelFirst: true,
                translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
                singleLine: true,
              },
            }
          : undefined,
      redact: [
        'req.headers.authorization',
        'req.body.password',
        'req.body.token',
      ],
    },
  };
};
