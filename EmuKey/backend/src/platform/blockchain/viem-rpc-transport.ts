import { fallback, http, type Transport } from 'viem';

const RPC_TIMEOUT_MS = 10_000;
const RPC_RETRY_COUNT = 2;

export function createViemRpcTransport(
  primaryUrl: string,
  fallbackUrl?: string,
): Transport {
  const primary = http(primaryUrl, {
    retryCount: RPC_RETRY_COUNT,
    timeout: RPC_TIMEOUT_MS,
  });
  if (!fallbackUrl || fallbackUrl === primaryUrl) return primary;
  return fallback(
    [
      primary,
      http(fallbackUrl, { retryCount: RPC_RETRY_COUNT, timeout: RPC_TIMEOUT_MS }),
    ],
    { rank: false, retryCount: 1 },
  );
}
