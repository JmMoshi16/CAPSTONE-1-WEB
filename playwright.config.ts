import { defineConfig } from '@playwright/test';
import { emulatorEnv } from './e2e/env.mjs';

// Browser smoke tests. Run with `npm run e2e`: builds the site against the emulators into .next-e2e,
// starts the Auth + Firestore emulators, serves the site on port 3917. Never touches the real project.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  // Same patience as the app (it waits 15 s before showing "Failed to load"); the first query after
  // the Firestore emulator starts can take more than Playwright's default 5 s.
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://127.0.0.1:3917', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npx next start -p 3917',
    url: 'http://127.0.0.1:3917',
    timeout: 120_000,
    reuseExistingServer: false,
    env: emulatorEnv,
  },
});
