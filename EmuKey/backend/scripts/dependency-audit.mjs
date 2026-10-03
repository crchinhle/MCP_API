import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const level = process.env.AUDIT_LEVEL ?? 'high';
const executable = process.platform === 'win32' ? process.execPath : 'corepack';
const args = ['pnpm', 'audit', '--prod', '--audit-level', level, '--json'];
if (process.platform === 'win32') args.unshift(join(dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js'));
const child = spawn(executable, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });
child.on('error', (error) => {
  console.error(JSON.stringify({ status: 'BLOCKED_EXTERNAL', blocker: 'PACKAGE_REGISTRY_UNAVAILABLE', detail: error.message }, null, 2));
  process.exitCode = 2;
});
child.on('exit', (code) => {
  const safeOutput = output.replaceAll(/https?:\/\/[^\s"']+/g, '[REDACTED_REGISTRY_URL]');
  console.log(JSON.stringify({ status: code === 0 ? 'PASS' : 'FAIL', auditLevel: level, output: safeOutput.slice(-20_000) }, null, 2));
  if (code !== 0) process.exitCode = code ?? 1;
});
