import { defineConfig } from '@playwright/test';

/**
 * Standalone config for the azureci on-demand E2E. The default config's global setup
 * registers and later deletes its own user; this suite must run against an existing
 * test account that owns the agent, so it has no global setup/teardown.
 */
export default defineConfig({
  testDir: 'specs/real',
  testMatch: /azci-on-demand\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 300000,
  reporter: [['line']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3080',
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
