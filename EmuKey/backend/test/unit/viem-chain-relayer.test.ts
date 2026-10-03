import {
  decodeFunctionData,
  keccak256,
  parseTransaction,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { ChainCommandInput } from '../../src/modules/blockchain/application/ports/chain-relayer.port.js';
import { licenseRegistryAbi } from '../../src/modules/blockchain/infrastructure/license-registry-contract.js';
import {
  ViemChainRelayer,
  encodeChainCommand,
  type ViemRelayerRpc,
} from '../../src/modules/blockchain/infrastructure/viem-chain-relayer.js';

const input: ChainCommandInput = {
  chainId: 31_337,
  commandId: '00000000-0000-4000-8000-000000000901',
  commandType: 'ISSUE_LICENSE',
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  network: 'hardhat',
  payload: {
    activationCommitment: `0x${'11'.repeat(32)}`,
    expiresAt: '2028-01-01T00:00:00.000Z',
    keyVersion: 1,
    licenseId: '00000000-0000-4000-8000-000000000401',
    maxActiveDevices: 3,
    planCommitment: `0x${'22'.repeat(32)}`,
    planId: '00000000-0000-4000-8000-000000000301',
    planVersion: 1,
    productId: '00000000-0000-4000-8000-000000000201',
    providerAddress: '0x0000000000000000000000000000000000000002',
  },
  payloadHash: `0x${'33'.repeat(32)}`,
};

describe('ViemChainRelayer', () => {
  it('encodes persisted catalog UUIDs without changing product or plan identity', () => {
    const encoded = encodeChainCommand({ ...input, payload: { ...input.payload,
      productId: 'e02c3bd8-b66e-a31b-83bf-ecaf10af8c83', planId: 'feeb4f2c-3ea5-9838-0b4a-185d6e3dab6f',
    } });
    const decoded = decodeFunctionData({ abi: licenseRegistryAbi, data: encoded });
    expect(decoded.functionName).toBe('issueLicense');
    expect(decoded.args?.[3]).toBe('0xe02c3bd8b66ea31b83bfecaf10af8c83');
    expect(decoded.args?.[4]).toBe('0xfeeb4f2c3ea598380b4a185d6e3dab6f');
  });
  it('encodes, signs and broadcasts the exact persisted EIP-1559 transaction', async () => {
    const account = privateKeyToAccount(`0x${'42'.repeat(32)}`);
    let serializedTransaction: Hex | undefined;
    const sendRawTransaction: ViemRelayerRpc['sendRawTransaction'] = ({
      serializedTransaction: raw,
    }) => {
      serializedTransaction = raw;
      return Promise.resolve(keccak256(raw));
    };
    const rpc: ViemRelayerRpc = {
      getChainId: vi.fn().mockResolvedValue(31_337),
      estimateFeesPerGas: vi.fn().mockResolvedValue({
        maxFeePerGas: 3_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      }),
      estimateGas: vi.fn().mockResolvedValue(100_000n),
      getTransactionCount: vi.fn().mockResolvedValue(9),
      getTransactionReceipt: vi.fn().mockRejectedValue(
        Object.assign(new Error('transaction could not be found'), {
          name: 'TransactionReceiptNotFoundError',
        }),
      ),
      sendRawTransaction: vi.fn(sendRawTransaction),
    };
    const signer = {
      publicAddress: () => Promise.resolve(account.address),
      sign: (digest: Hex) => account.sign({ hash: digest }),
    };
    const relayer = new ViemChainRelayer({
      chainId: 31_337,
      network: 'hardhat',
      rpc,
      rpcUrl: 'http://127.0.0.1:8545',
      signer,
    });

    await expect(relayer.getSubmissionContext(input)).resolves.toEqual({
      pendingNonce: 9,
      relayerAddress: account.address.toLowerCase(),
    });
    const transaction = await relayer.prepare(input, 9);
    await relayer.broadcast(transaction);

    expect(serializedTransaction).toBe(transaction.rawTransaction);
    expect(transaction.transactionHash).toBe(
      keccak256(transaction.rawTransaction as Hex),
    );
    const parsed = parseTransaction(transaction.rawTransaction as Hex);
    expect(parsed).toMatchObject({ chainId: 31_337, gas: 120_000n, nonce: 9 });
    const decoded = decodeFunctionData({
      abi: licenseRegistryAbi,
      data: parsed.data!,
    });
    expect(decoded.functionName).toBe('issueLicense');
    await expect(
      relayer.receipt(transaction.transactionHash),
    ).resolves.toBeNull();
  });

  it('classifies an uncertain RPC broadcast so reconciliation can reuse the raw transaction', async () => {
    const account = privateKeyToAccount(`0x${'42'.repeat(32)}`);
    const rpc = {
      getChainId: vi.fn().mockResolvedValue(31_337),
      estimateFeesPerGas: vi.fn().mockResolvedValue({
        maxFeePerGas: 3n,
        maxPriorityFeePerGas: 1n,
      }),
      estimateGas: vi.fn().mockResolvedValue(100_000n),
      getTransactionCount: vi.fn().mockResolvedValue(0),
      getTransactionReceipt: vi.fn(),
      sendRawTransaction: vi.fn().mockRejectedValue(new Error('socket closed')),
    } satisfies ViemRelayerRpc;
    const relayer = new ViemChainRelayer({
      chainId: 31_337,
      network: 'hardhat',
      rpc,
      rpcUrl: 'http://127.0.0.1:8545',
      signer: {
        publicAddress: () => Promise.resolve(account.address),
        sign: (digest) => account.sign({ hash: digest }),
      },
    });
    const transaction = await relayer.prepare(input, 0);

    await expect(relayer.broadcast(transaction)).rejects.toMatchObject({
      message: 'CHAIN_SUBMISSION_UNKNOWN',
      transactionHash: transaction.transactionHash,
    });
  });

  it('refuses to reserve a nonce when the RPC is connected to another chain', async () => {
    const account = privateKeyToAccount(`0x${'42'.repeat(32)}`);
    const rpc = {
      getChainId: vi.fn().mockResolvedValue(11_155_111),
      estimateFeesPerGas: vi.fn(),
      estimateGas: vi.fn(),
      getTransactionCount: vi.fn(),
      getTransactionReceipt: vi.fn(),
      sendRawTransaction: vi.fn(),
    } satisfies ViemRelayerRpc;
    const relayer = new ViemChainRelayer({
      chainId: 31_337,
      network: 'hardhat',
      rpc,
      rpcUrl: 'http://127.0.0.1:8545',
      signer: {
        publicAddress: () => Promise.resolve(account.address),
        sign: (digest) => account.sign({ hash: digest }),
      },
    });

    await expect(relayer.getSubmissionContext(input)).rejects.toThrow(
      'CHAIN_RPC_CHAIN_ID_MISMATCH',
    );
    expect(rpc.getTransactionCount).not.toHaveBeenCalled();
  });
});
