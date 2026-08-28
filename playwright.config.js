import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // This suite asserts on real animation timing (transition elapsedTime, phase
  // gaps, mid-flight geometry). Playwright would otherwise spawn one worker per
  // two cores, and on a 20-core box the resulting contention makes those
  // assertions flap on unrelated specs.
  workers: 4,
  outputDir: './test-results',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/Freentity/',
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'zh-TW',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/static-server.mjs',
    port: 4173,
    reuseExistingServer: false,
  },
});
