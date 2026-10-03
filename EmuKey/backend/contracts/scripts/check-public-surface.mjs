import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifactPath = resolve(
  'artifacts/solidity/LicenseRegistry.sol/LicenseRegistry.json',
);
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
const forbidden =
  /secret|plaintext|raw.?device|customer|email|terms.?content|price|payment/i;
const exposed = artifact.abi
  .filter((entry) => entry.type === 'event' || entry.type === 'function')
  .flatMap((entry) => [
    entry.name,
    ...(entry.inputs ?? []).map((input) => input.name),
  ])
  .filter((name) => forbidden.test(name));

if (exposed.length > 0) {
  throw new Error(`Forbidden public contract fields: ${exposed.join(', ')}`);
}
console.log(
  'Contract public surface contains no forbidden secret, PII, Terms, price or payment fields.',
);
