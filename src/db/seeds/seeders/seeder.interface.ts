import { EntityManager } from 'typeorm';

export interface Seeder {
  seed(manager: EntityManager): Promise<void>;
}
