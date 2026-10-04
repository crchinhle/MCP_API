import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const metadata = JSON.parse(await readFile(resolve(import.meta.dirname, '../deployments/sepolia-v3.json'), 'utf8'));
if (metadata.network !== 'sepolia' || metadata.chainId !== 11155111 || !/^0x[0-9a-fA-F]{40}$/.test(metadata.contractAddress) || !Number.isSafeInteger(metadata.deploymentBlock)) {
  throw new Error('SEPOLIA_V3_METADATA_INVALID');
}
process.stdout.write(`EVM_NETWORK=sepolia\nEVM_CHAIN_ID=11155111\nEVM_CONTRACT_ADDRESS=${metadata.contractAddress}\nEVM_DEPLOYMENT_BLOCK=${metadata.deploymentBlock}\n`);
