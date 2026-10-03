import { spawn } from 'node:child_process';

const args = process.argv.slice(2).filter((value) => value !== '--external');
const child = spawn('pnpm', ['exec', 'playwright', 'test', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...(process.argv.includes('--external') ? { E2E_EXTERNAL: 'true' } : {}) },
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
