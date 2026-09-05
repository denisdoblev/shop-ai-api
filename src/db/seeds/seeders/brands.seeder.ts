import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Brand } from '../../../brands/entities/brand.entity';
import { brandsSeedData } from '../data/brands.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class BrandsSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    await manager.getRepository(Brand).upsert([...brandsSeedData], {
      conflictPaths: ['slug'],
      indexPredicate: 'deleted_at IS NULL',
      skipUpdateIfNoValuesChanged: true,
    });
  }
}
