import { EvmReadinessProbe } from '../../../src/platform/health/evm-readiness.probe.js';

const config = {
  getOrThrow: vi.fn((name: string) => {
    if (name === 'EVM_CHAIN_ID') return 31_337;
    if (name === 'EVM_CONTRACT_ADDRESS') {
      return '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    }
    if (name === 'EVM_NETWORK') return 'hardhat';
    if (name === 'EVM_RPC_HTTP_URL') return 'http://127.0.0.1:8545';
    throw new Error(`Unexpected config ${name}`);
  }),
};

describe('EvmReadinessProbe', () => {
  it('accepts only the configured chain with deployed contract bytecode', async () => {
    const probe = new EvmReadinessProbe(config as never, {
      getChainId: vi.fn().mockResolvedValue(31_337),
      getCode: vi.fn().mockResolvedValue('0x60016000'),
    });

    await expect(probe.check()).resolves.toBeUndefined();
  });

  it('fails when the RPC chain or configured contract is unavailable', async () => {
    const wrongChain = new EvmReadinessProbe(config as never, {
      getChainId: vi.fn().mockResolvedValue(1),
      getCode: vi.fn(),
    });
    const missingContract = new EvmReadinessProbe(config as never, {
      getChainId: vi.fn().mockResolvedValue(31_337),
      getCode: vi.fn().mockResolvedValue('0x'),
    });

    await expect(wrongChain.check()).rejects.toThrow('EVM_CHAIN_ID_MISMATCH');
    await expect(missingContract.check()).rejects.toThrow(
      'EVM_CONTRACT_NOT_DEPLOYED',
    );
  });
});
