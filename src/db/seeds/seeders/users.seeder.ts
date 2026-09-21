import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EntityManager } from 'typeorm';
import { User } from '../../../auth/entities/user.entity';
import { ValidRoles } from '../../../auth/interfaces';
import { Seeder } from './seeder.interface';

@Injectable()
export class UsersSeeder implements Seeder {
  private readonly saltRounds = 10;

  constructor(private readonly configService: ConfigService) {}

  async seed(manager: EntityManager): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return;
    }

    const email = this.configService.getOrThrow<string>('SEED_ADMIN_EMAIL');
    const password = this.configService.getOrThrow<string>(
      'SEED_ADMIN_PASSWORD',
    );
    const repository = manager.getRepository(User);

    const existingUser = await repository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.email = :email', { email })
      .getOne();

    if (existingUser) {
      return;
    }

    await repository.save(
      repository.create({
        email,
        password: await bcrypt.hash(password, this.saltRounds),
        fullname: 'Seed Administrator',
        roles: [ValidRoles.ADMIN],
        isActive: true,
      }),
    );
  }
}
