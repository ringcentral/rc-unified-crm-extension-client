import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
