import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2).filter((value) => value !== '--external');
const child = spawn(process.execPath, [resolve(import.meta.dirname, '../../run.mjs'), 'frontend:e2e', ...args], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, ...(process.argv.includes('--external') ? { E2E_EXTERNAL: 'true' } : {}) },
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
