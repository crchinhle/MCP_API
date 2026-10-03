import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const root = process.cwd().endsWith(`${process.platform === 'win32' ? '\\' : '/'}frontend`)
  ? resolve(process.cwd(), '..')
  : process.cwd();
const processes = [];
const managedCompose = process.env.E2E_MANAGE_COMPOSE !== 'false';
const external = process.env.E2E_EXTERNAL === 'true';
const exec = promisify(execFile);
let redisWasRunning = false;

function command(program, args, cwd, env = {}) {
  const windowsCorepack = process.platform === 'win32' && program === 'corepack';
  const executable = windowsCorepack ? process.execPath : program;
  const childArgs = windowsCorepack
    ? [join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js'), ...args]
    : args;
  const child = spawn(executable, childArgs, {
    cwd,
    env: { ...process.env, ...env },
    shell: false,
    stdio: 'inherit',
  });
  processes.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      if (response.ok) return;
      lastError = `${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Readiness timeout for ${url}: ${lastError}`);
}

async function cleanup() {
  for (const child of processes.reverse()) {
    if (!child.killed) child.kill('SIGTERM');
  }
  if (managedCompose && !external && !redisWasRunning) {
    command('docker', ['compose', 'stop', 'redis'], root);
  }
}

process.once('SIGINT', async () => { await cleanup(); process.exit(130); });
process.once('SIGTERM', async () => { await cleanup(); process.exit(143); });

try {
  const requiredExternalIdentity = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD', 'E2E_ACTIVATION_KEY'];
  const missingIdentity = requiredExternalIdentity.filter((name) => !process.env[name]?.trim());
  if (missingIdentity.length > 0) {
    console.log(JSON.stringify({ status: 'BLOCKED_EXTERNAL', blocker: 'BLOCKED_EXTERNAL_TEST_IDENTITY', missing: missingIdentity }, null, 2));
    process.exit(2);
  }
  if (!external && managedCompose) {
    try {
      const running = await exec('docker', ['compose', 'ps', '--services', '--status', 'running'], { cwd: root });
      redisWasRunning = running.stdout.split(/\r?\n/).includes('redis');
    } catch {
      redisWasRunning = false;
    }
    const compose = command('docker', ['compose', 'up', '-d', 'redis'], root);
    await new Promise((resolve, reject) => {
      compose.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`docker compose exited ${code}`)));
    });
  }
  if (!external) {
    command('corepack', ['pnpm', 'build'], `${root}/backend`);
    await waitFor(`${process.env.API_URL ?? 'http://localhost:3000'}/api/v1/health/live`);
    command('corepack', ['pnpm', 'start:worker'], `${root}/backend`);
    command('corepack', ['pnpm', 'dev', '--', '--host', '0.0.0.0'], `${root}/frontend`);
    await waitFor(process.env.BASE_URL ?? 'http://localhost:5173');
  }
  const test = command('corepack', ['pnpm', 'e2e'], `${root}/frontend`, external ? { E2E_EXTERNAL: 'true' } : {});
  const code = await new Promise((resolve) => test.once('exit', resolve));
  await cleanup();
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await cleanup();
  process.exitCode = 1;
}
