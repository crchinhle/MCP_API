import { describe, expect, it, vi, afterEach } from 'vitest';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { HttpProviderLicenseGateway, isPublicProviderAddress, validateProviderUrl } from '../../../../EmuKey/backend/src/modules/licensing/infrastructure/http-provider-license.gateway.js';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('node:https', () => ({ request: vi.fn() }));

describe('provider callback SSRF boundary', () => {
  afterEach(() => vi.resetAllMocks());
  it('rejects a hostname if even one resolved address is private before opening a socket', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] as never);
    await expect(new HttpProviderLicenseGateway().send('https://provider.example/receive', 'server-token', {}, 'delivery')).rejects.toMatchObject({ code: 'PROVIDER_ADDRESS_BLOCKED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('pins the validated address into the connection lookup without resolving DNS again', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never);
    let socketLookup: (host: string, options: { all: boolean }, callback: (...args: unknown[]) => void) => void;
    vi.mocked(request).mockImplementation(((_url: unknown, options: { lookup: typeof socketLookup }, receive: (response: unknown) => void) => {
      socketLookup = options.lookup;
      const req = Object.assign(new EventEmitter(), {
        destroy: vi.fn(),
        end: () => {
          const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: {} });
          receive(response);
          response.emit('data', Buffer.from('{"accepted":true}'));
          response.emit('end');
          req.emit('close');
        },
      });
      return req;
    }) as never);
    await expect(new HttpProviderLicenseGateway().send('https://provider.example/receive', 'server-token', {}, 'delivery')).resolves.toEqual({ accepted: true });
    const callback = vi.fn();
    socketLookup!('provider.example', { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }]);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it.each([302, 200])('does not follow redirects or accept HTML receipts (HTTP %s)', async (status) => {
    let redirected = 0;
    const server = createServer((req, res) => {
      if (req.url === '/leak') redirected++;
      res.writeHead(status, { Location: '/leak', 'Content-Type': 'text/html' });
      res.end('<html>not a receipt</html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      await expect(new HttpProviderLicenseGateway(origin).send(`${origin}/receive`, 'private-token', {}, 'delivery')).rejects.toMatchObject({ code: status === 302 ? 'PROVIDER_HTTP_302' : 'PROVIDER_RECEIPT_INVALID' });
      expect(redirected).toBe(0);
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.2', '172.16.0.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1'])('blocks nonpublic address %s', (ip) => {
    expect(isPublicProviderAddress(ip)).toBe(false);
  });
  it('allows public addresses but requires TLS and no embedded credentials', () => {
    expect(isPublicProviderAddress('8.8.8.8')).toBe(true);
    expect(isPublicProviderAddress('2606:4700:4700::1111')).toBe(true);
    expect(() => validateProviderUrl('http://example.com/receive')).toThrow();
    expect(() => validateProviderUrl('https://token@example.com/receive')).toThrow();
    expect(() => validateProviderUrl('https://example.com/#secret')).toThrow();
    expect(validateProviderUrl('https://example.com/receive').hostname).toBe('example.com');
  });
  it('limits local testing to one exact configured origin', () => {
    expect(validateProviderUrl('http://127.0.0.1:4123/receive', 'http://127.0.0.1:4123').port).toBe('4123');
    expect(() => validateProviderUrl('http://127.0.0.1:4124/receive', 'http://127.0.0.1:4123')).toThrow();
  });
});
