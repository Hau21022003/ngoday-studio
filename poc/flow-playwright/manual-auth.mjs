import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { FLOW_URL, PROFILE_DIR, browserChannel, findInstalledBrowser } from './poc-config.mjs';

await mkdir(PROFILE_DIR, { recursive: true });

const executable = findInstalledBrowser();

console.log(`Opening installed ${browserChannel} without Playwright or remote debugging.`);
console.log(`Dedicated Video Studio profile: ${PROFILE_DIR}`);
console.log('Sign in to Google Flow manually and complete 2FA/CAPTCHA if requested.');
console.log('When Flow is open successfully, close every window belonging to this dedicated profile.');
console.log('No credentials are read or stored by this script.');

const child = spawn(
  executable,
  [`--user-data-dir=${PROFILE_DIR}`, '--profile-directory=Default', FLOW_URL],
  {
    stdio: 'ignore',
    windowsHide: false,
  },
);

const [exitCode] = await Promise.race([
  once(child, 'exit'),
  once(child, 'error').then(([error]) => {
    throw new Error(`Failed to open installed browser: ${error.message}`);
  }),
]);
if (exitCode && exitCode !== 0) {
  throw new Error(`Installed browser exited with code ${exitCode}`);
}

console.log('Manual authentication browser closed. The profile is ready for a Playwright reuse check.');
