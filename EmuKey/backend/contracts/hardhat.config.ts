import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem';
import { configVariable, defineConfig } from 'hardhat/config';

export default defineConfig({
  paths: {
    sources: './solidity',
    tests: './test',
  },
  plugins: [hardhatToolboxViemPlugin],
  networks: {
    localhost: {
      chainType: 'l1',
      type: 'http',
      url: configVariable('LOCAL_RPC_URL', {
        default: 'http://127.0.0.1:8545',
      }),
    },
    sepolia: {
      // One dedicated demo account owns the contract and relays transactions.
      // deploy:sepolia loads the same backend secret used by the runtime.
      accounts: [configVariable('EVM_RELAYER_PRIVATE_KEY')],
      chainType: 'l1',
      type: 'http',
      url: configVariable('EVM_RPC_HTTP_URL'),
    },
  },
  solidity: {
    profiles: {
      default: {
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
        version: '0.8.34',
      },
      production: {
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
        version: '0.8.34',
      },
    },
  },
});
