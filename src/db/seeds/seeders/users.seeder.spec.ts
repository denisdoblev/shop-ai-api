import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as bcrypt from 'bcrypt';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../../../auth/entities/user.entity';
import { ValidRoles } from '../../../auth/interfaces';
import { UsersSeeder } from './users.seeder';

jest.mock('bcrypt', () => ({ hash: jest.fn() }));

describe('UsersSeeder', () => {
  const getOne = jest.fn<Promise<User | null>, []>();
  const queryBuilder = {
    withDeleted: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne,
  } as unknown as SelectQueryBuilder<User>;
  const create = jest.fn((value: Partial<User>) => value as User);
  const save = jest.fn<Promise<User>, [User]>();
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create,
    save,
  } as unknown as Repository<User>;
  const getRepository = jest.fn(() => repository);
  const manager = {
    getRepository,
  } as unknown as EntityManager;
  const hash = jest.mocked(bcrypt.hash);

  const createSeeder = (values: Record<string, string>): UsersSeeder =>
    new UsersSeeder(
      new ConfigService({
        SEED_ADMIN_EMAIL: 'seed-admin@example.com',
        SEED_ADMIN_PASSWORD: 'LocalSeed9',
        ...values,
      }),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    getOne.mockResolvedValue(null);
    hash.mockResolvedValue('hashed-password' as never);
  });

  it('does not access users in production', async () => {
    await createSeeder({ NODE_ENV: 'production' }).seed(manager);

    expect(getRepository).not.toHaveBeenCalled();
  });

  it('creates the configured administrator', async () => {
    await createSeeder({ NODE_ENV: 'development' }).seed(manager);

    expect(hash).toHaveBeenCalledWith('LocalSeed9', 10);
    expect(create).toHaveBeenCalledWith({
      email: 'seed-admin@example.com',
      password: 'hashed-password',
      fullname: 'Seed Administrator',
      roles: [ValidRoles.ADMIN],
      isActive: true,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('leaves an existing account unchanged on repeated runs', async () => {
    getOne.mockResolvedValue({ email: 'seed-admin@example.com' } as User);

    await createSeeder({ NODE_ENV: 'test' }).seed(manager);

    expect(hash).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not contain the former public credential in seed source', () => {
    const leakedPassword = ['Abc', '123'].join('');
    const seedDirectory = join(__dirname, '..');
    const source = [
      readFileSync(join(seedDirectory, 'database-seeder.service.ts'), 'utf8'),
      readFileSync(join(seedDirectory, 'seeds.module.ts'), 'utf8'),
      readFileSync(join(__dirname, 'users.seeder.ts'), 'utf8'),
    ].join('\n');

    expect(source).not.toContain(leakedPassword);
  });
});
