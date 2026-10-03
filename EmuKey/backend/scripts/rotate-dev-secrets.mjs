import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

const path = fileURLToPath(new URL('../.env', import.meta.url));
const source = await readFile(path, 'utf8');
const replacements = new Map([
  ['JWT_SECRET', randomBytes(48).toString('base64url')],
  ['SESSION_SECRET', randomBytes(48).toString('base64url')],
  ['ACTIVATION_ENVELOPE_KEY', randomBytes(32).toString('hex')],
]);
const lines = source.split(/\r?\n/).map((line) => {
  const key = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];
  return key && replacements.has(key) ? `${key}=${replacements.get(key)}` : line;
});
await writeFile(path, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
console.log(JSON.stringify({ status: 'ROTATED_DEV_SECRETS', keys: [...replacements.keys()] }));
