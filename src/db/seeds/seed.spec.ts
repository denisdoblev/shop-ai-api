import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseSeederService } from './database-seeder.service';
import { bootstrapSeeds } from './seed';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: jest.fn(),
  },
}));
jest.mock('./seeds.module', () => ({
  SeedsModule: class SeedsModule {},
}));

describe('bootstrapSeeds', () => {
  const createApplicationContext = jest.mocked(
    // NestFactory exposes a static method; Jest replaces it with a mock for this suite.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    NestFactory.createApplicationContext,
  );
  const seed = jest.fn<Promise<void>, []>();
  const close = jest.fn<Promise<void>, []>();
  const get = jest.fn(() => ({ seed }));
  const app = {
    get,
    close,
  } as unknown as INestApplicationContext;

  beforeEach(() => {
    jest.clearAllMocks();
    createApplicationContext.mockResolvedValue(app);
  });

  it('runs the seeder and closes the application context', async () => {
    await bootstrapSeeds();

    expect(get).toHaveBeenCalledWith(DatabaseSeederService);
    expect(seed).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the application context when seeding fails', async () => {
    seed.mockRejectedValueOnce(new Error('seed failed'));

    await expect(bootstrapSeeds()).rejects.toThrow('seed failed');

    expect(close).toHaveBeenCalledTimes(1);
  });
});
