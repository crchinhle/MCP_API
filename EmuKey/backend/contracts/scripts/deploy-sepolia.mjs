import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createPublicClient, encodeDeployData, http } from 'viem';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

const root = resolve(import.meta.dirname, '..');
const deploymentId = 'sepolia-v3';
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

try {
  if (!process.env.EVM_RPC_HTTP_URL || !process.env.EVM_RELAYER_PRIVATE_KEY) {
    throw new Error('SEPOLIA_CREDENTIAL_MISSING');
  }
  const account = privateKeyToAccount(process.env.EVM_RELAYER_PRIVATE_KEY);
  const developmentAccounts = Array.from({ length: 20 }, (_, addressIndex) =>
    mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex }).address.toLowerCase());
  if (developmentAccounts.includes(account.address.toLowerCase())) throw new Error('DEFAULT_DEVELOPMENT_ACCOUNT');
  const client = createPublicClient({ transport: http(process.env.EVM_RPC_HTTP_URL, { timeout: 20_000, retryCount: 0 }) });
  if (await client.getChainId() !== 11155111) throw new Error('SEPOLIA_CHAIN_ID_REQUIRED');
  const artifact = await json('artifacts/solidity/LicenseRegistry.sol/LicenseRegistry.json');
  if (!artifact.abi.some((entry) => entry.name === 'syncActiveDeviceCount')) throw new Error('CURRENT_ABI_REQUIRED');
  const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args: [account.address, account.address] });
  const [balance, gas, fees] = await Promise.all([
    client.getBalance({ address: account.address }),
    client.estimateGas({ account: account.address, data }),
    client.estimateFeesPerGas(),
  ]);
  if (balance < gas * fees.maxFeePerGas * 2n) throw new Error('INSUFFICIENT_SEPOLIA_BALANCE');
  console.log(JSON.stringify({ chainId: 11155111, deployer: account.address, balanceWei: balance.toString(), estimatedGas: gas.toString() }));
  // Separate Ignition state preserves previous deployments and supports resuming v3.
  // See https://hardhat.org/docs/guides/deployment/using-ignition
  const result = spawnSync(process.execPath, [
    resolve(root, 'node_modules/hardhat/dist/src/cli.js'), 'ignition', 'deploy',
    'ignition/modules/LicenseRegistry.ts', '--network', 'sepolia', '--deployment-id', deploymentId,
  ], { cwd: root, env: { ...process.env, HARDHAT_IGNITION_CONFIRM_DEPLOYMENT: 'true' }, encoding: 'utf8', windowsHide: true });
  // Provider errors may contain credential-bearing URLs. Never forward raw output.
  if (result.status !== 0) throw new Error('IGNITION_DEPLOYMENT_FAILED_CHECK_PRIVATE_JOURNAL');
  const addresses = await json(`ignition/deployments/${deploymentId}/deployed_addresses.json`);
  const address = addresses['LicenseRegistryModule#LicenseRegistry'];
  const entries = (await readFile(resolve(root, `ignition/deployments/${deploymentId}/journal.jsonl`), 'utf8'))
    .split(/\r?\n/).filter((line) => line.trim()).map(JSON.parse);
  const transaction = entries.find((entry) => entry.type === 'TRANSACTION_CONFIRM' && entry.futureId === 'LicenseRegistryModule#LicenseRegistry');
  if (!transaction) throw new Error('DEPLOYMENT_RECEIPT_MISSING');
  const receipt = await client.getTransactionReceipt({ hash: transaction.hash });
  if (receipt.status !== 'success' || receipt.contractAddress?.toLowerCase() !== address.toLowerCase()) throw new Error('DEPLOYMENT_RECEIPT_MISMATCH');
  const bytecode = await client.getCode({ address });
  if (bytecode !== artifact.deployedBytecode) throw new Error('DEPLOYED_BYTECODE_MISMATCH');
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const metadata = {
    network: 'sepolia', chainId: 11155111, contractName: 'LicenseRegistry', contractAddress: address,
    deploymentTransaction: receipt.transactionHash, deploymentBlock: Number(receipt.blockNumber),
    deployerAddress: account.address, deployedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
    abiPath: '../../src/modules/blockchain/infrastructure/generated/license-registry.abi.json',
    deploymentVersion: 3, protocolVersion: 2, domain: 'DOMAIN_PLAN_V2', deviceAggregateSync: true,
    ignitionDeploymentId: deploymentId, bytecodeVerified: true,
  };
  await writeFile(resolve(root, 'deployments/sepolia-v3.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata));
} catch (error) {
  const safe = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'SEPOLIA_DEPLOYMENT_UNAVAILABLE';
  console.error(`BLOCKED: ${safe}`);
  process.exitCode = 1;
}
