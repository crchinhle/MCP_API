import { privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';

import type { ChainDigestSigner } from './viem-chain-relayer.js';

export class LocalPrivateKeyChainSigner implements ChainDigestSigner {
  private readonly account;

  constructor(privateKey: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error('EVM_RELAYER_PRIVATE_KEY must contain a 32-byte hex key');
    }
    this.account = privateKeyToAccount(privateKey as Hex);
  }

  publicAddress(): Promise<Address> {
    return Promise.resolve(this.account.address);
  }

  sign(digest: Hex): Promise<Hex> {
    return this.account.sign({ hash: digest });
  }
}
