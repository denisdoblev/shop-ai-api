import * as dotenv from 'dotenv';
import { configureE2eEnvironment } from '../src/config/e2e-database.config';

dotenv.config({ quiet: true });
configureE2eEnvironment(process.env);
