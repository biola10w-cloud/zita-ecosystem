import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin', workers: 1,
  use: { baseURL: 'http://localhost:4320', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../admin/tests/book-management-api.cjs', port: 4321 },
    { command: 'node ../admin/node_modules/next/dist/bin/next start ../admin -p 4320', port: 4320,
      env: { API_BASE_URL: 'http://127.0.0.1:4321/api/v1' }, timeout: 60000 },
  ],
});
