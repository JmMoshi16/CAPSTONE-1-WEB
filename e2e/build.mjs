// Builds the site for the browser tests. Runs BEFORE the emulators start: inside `firebase
// emulators:exec` the Firebase CLI's environment breaks next/font's download of the Inter font.
import { spawnSync } from 'node:child_process';
import { emulatorEnv } from './env.mjs';

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...emulatorEnv },
});
process.exit(result.status ?? 1);
