import * as dotenv from 'dotenv';
import { configureE2eEnvironment } from '../src/config/e2e-database.config';

dotenv.config({ quiet: true });
configureE2eEnvironment(process.env);
process.env.SEED_ADMIN_EMAIL ??= 'seed-admin@example.com';
process.env.SEED_ADMIN_PASSWORD ??= 'LocalSeed9';
