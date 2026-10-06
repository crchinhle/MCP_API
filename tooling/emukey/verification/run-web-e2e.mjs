import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const root = resolve(import.meta.dirname, '../../../EmuKey');
// One canonical frontend URL: used for the Vite bind host/port, readiness, and
// the Playwright child baseURL so the runner never waits on one URL while the
// browser navigates to another.
const baseUrl = process.env.BASE_URL?.trim() || 'http://127.0.0.1:5173';
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

async function isReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function composeServiceRunning(service) {
  try {
    const { stdout } = await exec('docker', ['compose', 'ps', '--services', '--status', 'running'], { cwd: composeRoot });
    return stdout.split(/\r?\n/).includes(service);
  } catch {
    return false;
  }
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

async function waitForFrontendReady(child, url, timeoutMs = 120_000) {
  let exitHandler;
  let errorHandler;
  const frontendExited = new Promise((_, reject) => {
    exitHandler = (code, signal) => reject(new Error(`E2E_FRONTEND_START_FAILED: frontend exited before readiness (code=${code ?? 'null'}, signal=${signal ?? 'none'})`));
    errorHandler = (error) => reject(new Error(`E2E_FRONTEND_START_FAILED: frontend failed to start (${error.message})`));
    child.once('exit', exitHandler);
    child.once('error', errorHandler);
  });
  const readiness = waitFor(url, timeoutMs).catch((error) => {
    throw new Error(`E2E_FRONTEND_NOT_READY: ${error instanceof Error ? error.message : String(error)}`);
  });
  try {
    await Promise.race([readiness, frontendExited]);
  } finally {
    child.off('exit', exitHandler);
    child.off('error', errorHandler);
  }
}

async function assertFrontendPortAvailable(url) {
  const port = Number(new URL(url).port || 5173);
  try {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command', `Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -eq ${port} | Select-Object -ExpandProperty OwningProcess`]);
    const owners = [...new Set(stdout.split(/\r?\n/).map(Number).filter((value) => Number.isInteger(value) && value > 0))];
    if (owners.length === 0) return;
    for (const pid of owners) {
      const { stdout: commandLine } = await exec('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction SilentlyContinue).CommandLine`]);
      const normalized = commandLine.trim();
      if (!normalized) continue;
      if (normalized.includes('frontend\\node_modules') && normalized.includes('vite') && normalized.includes(String(port))) {
        throw new Error(`E2E_FRONTEND_PORT_IN_USE: stale Vite process ${pid} owns port ${port}; stop the runner-owned diagnostic process before rerunning.`);
      }
    }
    throw new Error(`E2E_FRONTEND_PORT_IN_USE: port ${port} is already owned by process(es) ${owners.join(', ')}; ownership was not confirmed as runner-owned.`);
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('E2E_FRONTEND_'))) throw error;
    throw new Error(`E2E_FRONTEND_PORT_CHECK_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Compose for the Redis dependency lives beside the product services it backs.
// Root Compose here would fight the running backend project for port 6379.
const composeRoot = join(root, 'backend');

async function waitForComposeHealthy(service, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = 'unknown';
  while (Date.now() < deadline) {
    try {
      const { stdout } = await exec('docker', ['compose', 'ps', '--format', 'json', service], { cwd: composeRoot });
      const rows = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      const row = rows[0];
      lastState = row ? `${row.State} health=${row.Health || 'none'}` : 'missing';
      if (row?.Health === 'healthy') return;
    } catch (error) {
      lastState = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`REDIS_HEALTHCHECK_FAILED: compose service ${service} never became healthy (last: ${lastState})`);
}

async function cleanup() {
  for (const child of processes.reverse()) {
    if (process.platform === 'win32' && child.pid) {
      await exec('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => undefined);
    } else if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  if (managedCompose && !external && !redisWasRunning) {
    await exec('docker', ['compose', 'stop', 'redis'], { cwd: composeRoot }).catch(() => undefined);
  }
}

process.once('SIGINT', async () => { await cleanup(); process.exit(130); });
process.once('SIGTERM', async () => { await cleanup(); process.exit(143); });

try {
  const requiredExternalIdentity = ['E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'];
  const missingIdentity = requiredExternalIdentity.filter((name) => !process.env[name]?.trim());
  if (missingIdentity.length > 0) {
    console.log(JSON.stringify({ status: 'BLOCKED_EXTERNAL', blocker: 'BLOCKED_EXTERNAL_TEST_IDENTITY', missing: missingIdentity }, null, 2));
    process.exit(2);
  }
  if (!process.env.E2E_RUN_ID) {
    process.env.E2E_RUN_ID = `canonical-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
  }
  if (!external && managedCompose) {
    try {
      const running = await exec('docker', ['compose', 'ps', '--services', '--status', 'running'], { cwd: composeRoot });
      redisWasRunning = running.stdout.split(/\r?\n/).includes('redis');
    } catch {
      redisWasRunning = false;
    }
    const compose = command('docker', ['compose', 'up', '-d', 'redis'], composeRoot);
    await new Promise((resolve, reject) => {
      compose.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`REDIS_CONTAINER_START_FAILED: docker compose exited ${code}`)));
    });
    // The service has a healthcheck; wait for it instead of assuming a started
    // container is already accepting connections.
    await waitForComposeHealthy('redis');
  }
  if (!external) {
    const apiUrl = process.env.API_URL?.trim() || 'http://127.0.0.1:3000';
    // The backend Compose project owns the API/worker. Reuse it when it is
    // already healthy instead of fighting it for ports 3000/5173.
    if (await composeServiceRunning('api')) {
      await waitFor(`${apiUrl}/api/v1/health/live`);
    } else {
      const build = command('corepack', ['pnpm', 'build'], `${root}/backend`);
      await new Promise((resolve, reject) => build.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Backend build failed: ${code}`))));
      command('corepack', ['pnpm', 'start:api'], `${root}/backend`);
      await waitFor(`${apiUrl}/api/v1/health/live`);
      command('corepack', ['pnpm', 'start:worker'], `${root}/backend`);
    }
    // Always use a runner-owned Vite process for canonical E2E. A reused stale
    // dev server can retain an old proxy target and hide the real API state.
    const frontendPort = new URL(baseUrl).port || '5173';
    await assertFrontendPortAvailable(baseUrl);
    const frontend = command('corepack', ['pnpm', 'exec', 'vite', '--host', '127.0.0.1', '--port', frontendPort, '--strictPort'], `${root}/frontend`, {
      VITE_API_URL: '/api/v1',
    });
    await waitForFrontendReady(frontend, baseUrl);
  }
  const test = command(process.execPath, [resolve(import.meta.dirname, '../run.mjs'), 'frontend:e2e', ...process.argv.slice(2)], root, {
    E2E_EXTERNAL: 'true',
    BASE_URL: baseUrl,
    E2E_API_BASE_URL: process.env.E2E_API_BASE_URL?.trim() || 'http://127.0.0.1:3000/api/v1',
  });
  const code = await new Promise((resolve) => test.once('exit', resolve));
  await cleanup();
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await cleanup();
  process.exitCode = 1;
}
