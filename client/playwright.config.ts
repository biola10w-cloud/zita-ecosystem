import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://localhost:4310', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/mock-api.cjs', port: 4311 },
    { command: 'node node_modules/next/dist/bin/next start -p 4310', port: 4310,
      env: { API_BASE_URL: 'http://127.0.0.1:4311/api/v1' }, timeout: 60000 },
  ],
});
