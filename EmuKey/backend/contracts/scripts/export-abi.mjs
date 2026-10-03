import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const contractRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = resolve(
  contractRoot,
  'artifacts/solidity/LicenseRegistry.sol/LicenseRegistry.json',
);
const outputPath = resolve(
  contractRoot,
  '../src/modules/blockchain/infrastructure/generated/license-registry.abi.json',
);
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(artifact.abi, null, 2)}\n`,
  'utf8',
);
console.log(`Exported LicenseRegistry ABI to ${outputPath}`);
