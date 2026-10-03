import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tracked = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean);
const forbidden = tracked.filter((name) => {
  const base = name.split('/').at(-1) ?? '';
  return (
    (base.startsWith('.env') && base !== '.env.example') ||
    /\.(pem|key|p12)$/i.test(base)
  );
});
if (forbidden.length)
  throw new Error(`Forbidden delivery files: ${forbidden.join(', ')}`);
const dockerIgnore = await readFile(resolve(root, '.dockerignore'), 'utf8');
if (
  !dockerIgnore.includes('.env*') ||
  !dockerIgnore.includes('contracts/artifacts')
) {
  throw new Error(
    'Docker ignore rules do not exclude environment or contract build artefacts',
  );
}
console.log('Delivery source scan passed: no real env or private-key files.');
