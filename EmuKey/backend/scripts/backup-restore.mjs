import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { URL } from 'node:url';

const databaseUrl = process.env.DATABASE_URL;
const output = resolve(
  process.env.BACKUP_OUTPUT_DIR ?? '../docs/traceability/releases',
  process.env.RELEASE_RUN_ID ?? `backup-${new Date().toISOString().replaceAll(':', '-')}`,
);
const dumpFile = resolve(output, 'postgres.dump');
const metadataFile = resolve(output, 'backup-metadata.json');
const dumpImage = process.env.POSTGRES_CLIENT_IMAGE ?? 'postgres:18-alpine';
const restoreImage = process.env.POSTGRES_RESTORE_IMAGE ?? 'pgvector/pgvector:pg18';
const disposable = process.env.RESTORE_DISPOSABLE === 'true' || process.argv.includes('--disposable');
const reconcile = process.env.RESTORE_RECONCILE === 'true' || process.argv.includes('--reconcile');
const containerName = `emukey-restore-${randomUUID().slice(0, 8)}`;
const hostPort = Number(process.env.RESTORE_HOST_PORT ?? 55432);

await mkdir(output, { recursive: true });

function run(command, args, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      shell: false,
      ...(options.env ? { env: options.env } : {}),
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolveResult({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2_000)}`));
    });
  });
}

async function writeMetadata(status, details = {}) {
  await writeFile(metadataFile, `${JSON.stringify({
    status,
    createdAt: new Date().toISOString(),
    database: 'redacted',
    dump: 'postgres.dump',
    ...details,
    chainReconcile: 'Run BC-04 reconcile/indexer after restore against the canonical chain head.',
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status, dumpFile: 'postgres.dump', metadataFile: 'backup-metadata.json', ...details }, null, 2));
}

async function dump() {
  try {
    await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', dumpFile, databaseUrl]);
  } catch (error) {
    if (error?.code !== 'ENOENT' && !String(error?.message).includes('spawn pg_dump') && !String(error?.message).includes('server version mismatch')) throw error;
    await run('docker', [
      'run', '--rm', '-v', `${output}:/backup`, dumpImage,
      'pg_dump', '--format=custom', '--no-owner', '--no-privileges',
      '--file', '/backup/postgres.dump', databaseUrl,
    ]);
  }
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await run('docker', ['exec', containerName, 'pg_isready', '-U', 'restore', '-d', 'restore_db']);
      return;
    } catch {
      await new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, 1_000));
    }
  }
  throw new Error('RESTORE_POSTGRES_READINESS_TIMEOUT');
}

async function restoreIntoDisposable() {
  const restorePassword = randomUUID();
  const restoreUrl = new URL(`postgresql://restore@127.0.0.1:${hostPort}/restore_db`);
  restoreUrl.password = restorePassword;
  await run('docker', [
    'run', '-d', '--name', containerName,
    '-e', 'POSTGRES_USER=restore',
    '-e', 'POSTGRES_PASSWORD',
    '-e', 'POSTGRES_DB=restore_db',
    '-p', `127.0.0.1:${hostPort}:5432`,
    restoreImage,
  ], { env: { ...process.env, POSTGRES_PASSWORD: restorePassword } });
  try {
    await waitForPostgres();
    const network = `container:${containerName}`;
    await run('docker', [
      'run', '--rm', '--network', network, '-v', `${output}:/backup`,
      '-e', 'PGPASSWORD', restoreImage,
      'pg_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges',
      '--dbname', 'postgresql://restore@127.0.0.1:5432/restore_db',
      '/backup/postgres.dump',
    ], { env: { ...process.env, PGPASSWORD: restorePassword } });
    let reconcileStatus = 'NOT_REQUESTED';
    let reconcileError;
    if (reconcile) {
      const packageManager = process.platform === 'win32' ? process.execPath : 'corepack';
      const packageManagerArgs = process.platform === 'win32'
        ? [join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js'), 'pnpm', 'reconcile:run']
        : ['pnpm', 'reconcile:run'];
      try {
        await run(packageManager, packageManagerArgs, {
          env: {
            ...process.env,
            DATABASE_URL: restoreUrl.toString(),
            RECONCILE_RESTORE_MODE: 'true',
          },
        });
        reconcileStatus = 'RESTORE_RECONCILE_VERIFIED';
      } catch (error) {
        reconcileStatus = 'RESTORE_RECONCILE_BLOCKED_CANONICAL_CONTEXT';
        reconcileError = error instanceof Error ? error.message.slice(-1_000) : String(error);
      }
    }
    const verification = await run('docker', [
      'exec', containerName, 'psql', '-U', 'restore', '-d', 'restore_db', '-At', '-c',
      "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM orders), (SELECT count(*) FROM licenses), (SELECT count(*) FROM chain_commands), (SELECT count(*) FROM chain_events), (SELECT count(*) FROM audit_logs)",
    ], { capture: true });
    await writeMetadata('RESTORE_VERIFIED', {
      disposableDatabase: true,
      durableRowCounts: verification.stdout.trim(),
      restoreCommand: 'pg_restore executed inside a disposable PostgreSQL 18 container',
      reconcileStatus,
      ...(reconcileError ? { reconcileError } : {}),
    });
    if (reconcileError) process.exitCode = 2;
  } finally {
    await run('docker', ['rm', '--force', containerName]).catch(() => undefined);
  }
}

if (!databaseUrl) {
  console.error('BLOCKED_EXTERNAL: DATABASE_URL is not configured');
  process.exitCode = 2;
} else {
  try {
    await dump();
    if (disposable) await restoreIntoDisposable();
    else await writeMetadata('BACKUP_CREATED', { restoreCommand: 'Use RESTORE_DISPOSABLE=true for automatic disposable restore.' });
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
