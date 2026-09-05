import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Attribute } from '../../../attributes/entities/attribute.entity';
import { attributesSeedData } from '../data/attributes.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class AttributesSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    await manager.getRepository(Attribute).upsert([...attributesSeedData], {
      conflictPaths: ['slug'],
      indexPredicate: 'deleted_at IS NULL',
      skipUpdateIfNoValuesChanged: true,
    });
  }
}
