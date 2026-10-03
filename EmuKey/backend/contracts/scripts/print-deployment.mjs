import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argumentsWithoutSeparator = process.argv
  .slice(2)
  .filter((argument) => argument !== '--');
const chainId = argumentsWithoutSeparator[0] ?? '31337';
if (!/^\d+$/.test(chainId)) {
  throw new Error(`Invalid chain ID: ${chainId}`);
}
const path = resolve(
  'ignition',
  'deployments',
  `chain-${chainId}`,
  'deployed_addresses.json',
);
const deployments = JSON.parse(await readFile(path, 'utf8'));
const v2Path = resolve('deployments', 'sepolia-v2.json');
const v2 = chainId === '11155111' ? JSON.parse(await readFile(v2Path, 'utf8')) : null;
const address = v2?.contractAddress ?? deployments['LicenseRegistryModule#LicenseRegistry'];
if (typeof address !== 'string') {
  throw new Error('LicenseRegistry deployment address was not found');
}
process.stdout.write(`EVM_CONTRACT_ADDRESS=${address}\n`);
