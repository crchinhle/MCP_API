import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getContractAddress,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const HARDHAT_DEPLOYER_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const rpcUrl = process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545';
const account = privateKeyToAccount(HARDHAT_DEPLOYER_KEY);
const relayer = process.env.LOCAL_RELAYER_ADDRESS ?? account.address;
const chain = defineChain({
  id: 31_337,
  name: 'hardhat',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});
const expectedAddress = getContractAddress({ from: account.address, nonce: 0n });
const existingCode = await publicClient.getCode({ address: expectedAddress });
const artifact = JSON.parse(
  await readFile(
    resolve('artifacts', 'solidity', 'LicenseRegistry.sol', 'LicenseRegistry.json'),
    'utf8',
  ),
);

if (existingCode && existingCode !== '0x') {
  if (artifact.deployedBytecode && existingCode.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) {
    throw new Error('LOCAL_LICENSE_REGISTRY_ARTIFACT_MISMATCH_RESET_CHAIN_REQUIRED');
  }
  process.stdout.write(
    `${JSON.stringify({ address: expectedAddress, event: 'contract.reused' })}\n`,
  );
  process.exit(0);
}

const nonce = await publicClient.getTransactionCount({ address: account.address });
if (nonce !== 0) {
  throw new Error(
    `Refusing non-deterministic local deployment: deployer nonce is ${nonce}, expected 0`,
  );
}

const transactionHash = await walletClient.deployContract({
  abi: artifact.abi,
  account,
  args: [account.address, relayer],
  bytecode: artifact.bytecode,
});
const receipt = await publicClient.waitForTransactionReceipt({
  hash: transactionHash,
});
if (
  receipt.status !== 'success' ||
  receipt.contractAddress?.toLowerCase() !== expectedAddress.toLowerCase()
) {
  throw new Error('Local LicenseRegistry deployment verification failed');
}
process.stdout.write(
  `${JSON.stringify({
    address: receipt.contractAddress,
    blockNumber: Number(receipt.blockNumber),
    event: 'contract.deployed',
    transactionHash,
  })}\n`,
);
