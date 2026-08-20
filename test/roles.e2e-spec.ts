import { INestApplication } from '@nestjs/common';
import { initTestApp, closeTestApp, clearDatabase } from './test-utils';

describe.skip('Roles (e2e) - skeleton', () => {
  // No role-protected endpoints currently exposed for e2e; keep as a placeholder
  let app: INestApplication;

  beforeAll(async () => {
    app = await initTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('should return 403 for non-admin on admin-protected route (placeholder)', async () => {
    // Implement when admin endpoints are available
  });
});
