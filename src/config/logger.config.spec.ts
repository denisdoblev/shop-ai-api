import { ConfigService } from '@nestjs/config';
import { loggerConfigFactory } from './logger.config';

describe('Logger configuration', () => {
  it('uses pino-pretty in development', () => {
    const config = loggerConfigFactory(
      new ConfigService({ NODE_ENV: 'development' }),
    );

    expect(config.pinoHttp).toMatchObject({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
      },
    });
  });

  it('does not create a transport in tests', () => {
    const config = loggerConfigFactory(new ConfigService({ NODE_ENV: 'test' }));

    expect(config.pinoHttp).toMatchObject({
      level: 'debug',
      transport: undefined,
    });
  });

  it('uses structured info logs in production', () => {
    const config = loggerConfigFactory(
      new ConfigService({ NODE_ENV: 'production' }),
    );

    expect(config.pinoHttp).toMatchObject({
      level: 'info',
      transport: undefined,
    });
  });
});
