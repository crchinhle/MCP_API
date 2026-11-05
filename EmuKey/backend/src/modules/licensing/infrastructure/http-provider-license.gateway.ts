import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { BlockList, isIP } from 'node:net';
import {
  ProviderTransportError,
  type ProviderLicenseGatewayPort,
} from '../application/ports/provider-license-gateway.port.js';

const blocked = new BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(ip, prefix);
blocked.addSubnet('2001::', 23, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');
blocked.addSubnet('3fff::', 20, 'ipv6');

export function isPublicProviderAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, 'ipv4');
  return family === 6 && /^[23]/i.test(ip) && !blocked.check(ip, 'ipv6');
}

export function validateProviderUrl(value: string, localOrigin?: string): URL {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    value.length > 2048
  )
    throw new Error('PROVIDER_URL_INVALID');
  if (
    localOrigin &&
    url.origin === localOrigin &&
    ['http:', 'https:'].includes(url.protocol)
  )
    return url;
  if (url.protocol !== 'https:' || (url.port && url.port !== '443'))
    throw new Error('PROVIDER_HTTPS_REQUIRED');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !isPublicProviderAddress(host))
    throw new Error('PROVIDER_ADDRESS_BLOCKED');
  return url;
}

/** DNS is resolved and validated once per request, then pinned in the socket lookup. */
export class HttpProviderLicenseGateway implements ProviderLicenseGatewayPort {
  constructor(private readonly localOrigin?: string) {}
  validateEndpoint(endpoint: string): void {
    validateProviderUrl(endpoint, this.localOrigin);
  }

  async send(
    endpoint: string,
    token: string,
    body: unknown,
    deliveryId: string,
  ): Promise<unknown> {
    const started = Date.now();
    const url = validateProviderUrl(endpoint, this.localOrigin);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const local = this.localOrigin === url.origin;
    let addresses: { address: string; family: number }[];
    try {
      addresses = isIP(host)
        ? [{ address: host, family: isIP(host) }]
        : await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('DNS_TIMEOUT')),
              10_000,
            );
            void lookup(host, { all: true })
              .then(resolve, reject)
              .finally(() => clearTimeout(timer));
          });
    } catch {
      throw new ProviderTransportError('PROVIDER_DNS_UNAVAILABLE', true);
    }
    if (
      !addresses.length ||
      (!local && addresses.some((a) => !isPublicProviderAddress(a.address)))
    )
      throw new ProviderTransportError('PROVIDER_ADDRESS_BLOCKED');
    const pinned = addresses[0]!;
    const payload = JSON.stringify(body);
    if (Buffer.byteLength(payload) > 128 * 1024)
      throw new ProviderTransportError('PROVIDER_PAYLOAD_TOO_LARGE');
    return new Promise((resolve, reject) => {
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          method: 'POST',
          agent: false,
          lookup: (_hostname, options, callback) =>
            options.all
              ? callback(null, [pinned])
              : callback(null, pinned.address, pinned.family),
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': deliveryId,
          },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (![200, 201].includes(status)) {
            response.resume();
            const seconds = Number(response.headers['retry-after']);
            reject(
              new ProviderTransportError(
                `PROVIDER_HTTP_${status}`,
                [408, 429].includes(status) || status >= 500,
                Number.isFinite(seconds) && seconds > 0
                  ? Math.min(seconds * 1000, 21_600_000)
                  : undefined,
              ),
            );
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 65_536) {
              response.destroy();
              reject(new ProviderTransportError('PROVIDER_RESPONSE_TOO_LARGE'));
            } else chunks.push(chunk);
          });
          response.on('end', () => {
            try {
              resolve(
                JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
              );
            } catch {
              reject(new ProviderTransportError('PROVIDER_RECEIPT_INVALID'));
            }
          });
          response.on('error', () =>
            reject(new ProviderTransportError('PROVIDER_NETWORK_ERROR', true)),
          );
        },
      );
      const deadline = setTimeout(
        () => request.destroy(new Error('PROVIDER_TIMEOUT')),
        Math.max(1, 10_000 - (Date.now() - started)),
      );
      request.on('close', () => clearTimeout(deadline));
      request.on('error', () =>
        reject(new ProviderTransportError('PROVIDER_NETWORK_ERROR', true)),
      );
      request.end(payload);
    });
  }
}
