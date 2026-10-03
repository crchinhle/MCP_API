import { randomUUID } from 'node:crypto';

import {
  createPublicClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { ChainCommandInput } from '../../../src/modules/blockchain/application/ports/chain-relayer.port.js';
import { ViemChainEventSource } from '../../../src/modules/blockchain/infrastructure/viem-chain-event-source.js';
import { ViemChainRelayer } from '../../../src/modules/blockchain/infrastructure/viem-chain-relayer.js';
import { uuidToBytes16 } from '../../../src/platform/crypto/license-crypto.js';

const rpcUrl = process.env.LOCAL_EVM_RPC_URL;
const contractAddress = process.env.LOCAL_EVM_CONTRACT_ADDRESS as
  Address | undefined;
const describeRpc = rpcUrl && contractAddress ? describe : describe.skip;

describeRpc(
  'viem relayer and event source against a real Hardhat JSON-RPC node',
  () => {
    it('signs, broadcasts and reads the canonical LicenseIssued event', async () => {
      const account = privateKeyToAccount(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      );
      const chain = defineChain({
        id: 31_337,
        name: 'hardhat',
        nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
        rpcUrls: { default: { http: [rpcUrl!] } },
        testnet: true,
      });
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
      const signer = {
        publicAddress: () => Promise.resolve(account.address),
        sign: (digest: Hex) => account.sign({ hash: digest }),
      };
      const relayer = new ViemChainRelayer({
        chainId: 31_337,
        network: 'hardhat',
        rpcUrl: rpcUrl!,
        signer,
      });
      const commandId = randomUUID();
      const licenseId = randomUUID();
      const input: ChainCommandInput = {
        chainId: 31_337,
        commandId,
        commandType: 'ISSUE_LICENSE',
        contractAddress: contractAddress!,
        network: 'hardhat',
        payload: {
          activationCommitment: `0x${'11'.repeat(32)}`,
          expiresAt: '2030-01-01T00:00:00.000Z',
          keyVersion: 1,
          licenseId,
          maxActiveDevices: 3,
          planCommitment: `0x${'22'.repeat(32)}`,
          planId: randomUUID(),
          planVersion: 1,
          productId: randomUUID(),
          providerAddress: '0x0000000000000000000000000000000000000002',
        },
        payloadHash: `0x${'33'.repeat(32)}`,
      };

      const context = await relayer.getSubmissionContext(input);
      const transaction = await relayer.prepare(input, context.pendingNonce);
      await relayer.broadcast(transaction);
      const mined = await publicClient.waitForTransactionReceipt({
        hash: transaction.transactionHash as Hex,
      });

      await expect(
        relayer.receipt(transaction.transactionHash),
      ).resolves.toMatchObject({
        blockHash: mined.blockHash,
        status: 'SUCCESS',
        transactionHash: transaction.transactionHash,
      });
      const events = await new ViemChainEventSource({
        chainId: 31_337,
        contractAddress: contractAddress!,
        network: 'hardhat',
        rpcUrl: rpcUrl!,
      }).contractEvents(0, Number(mined.blockNumber));
      expect(
        events.every((candidate) =>
          [
            'ActivationKeyRotated',
            'DeviceStatusChanged',
            'LicenseIssued',
            'LicenseRenewed',
            'LicenseStatusChanged',
          ].includes(candidate.eventName),
        ),
      ).toBe(true);
      const event = events.find(
        (candidate) =>
          candidate.transactionHash === transaction.transactionHash,
      );
      expect(event?.args.commandId).toBe(uuidToBytes16(commandId));
      expect(event?.args.licenseId).toBe(uuidToBytes16(licenseId));
      expect(event).toMatchObject({
        blockHash: mined.blockHash,
        eventName: 'LicenseIssued',
        transactionHash: transaction.transactionHash,
      });
    }, 20_000);
  },
);
