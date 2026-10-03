import type { Abi } from 'viem';

import abi from './generated/license-registry.abi.json' with { type: 'json' };

export const licenseRegistryAbi = abi as Abi;
