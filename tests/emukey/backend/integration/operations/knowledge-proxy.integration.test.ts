import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GenericContainer, TestContainers, type StartedTestContainer } from 'testcontainers';

describe('knowledge upload through the production Caddy rules', () => {
  let upstream: Server;
  let proxy: StartedTestContainer;
  let baseUrl: string;
  beforeAll(async () => {
    // Byte-counting upstream isolates proxy limits; Nest upload validation is covered separately.
    upstream = createServer((request, response) => {
      let bytes = 0;
      request.on('data', (chunk: Buffer) => { bytes += chunk.length; });
      request.on('end', () => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ bytes })); });
    });
    await new Promise<void>((done) => upstream.listen(0, '0.0.0.0', done));
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('No upstream port');
    await TestContainers.exposeHostPorts(address.port);
    const caddy = await readFile(resolve(import.meta.dirname, '../../../../../EmuKey/frontend/Caddyfile'), 'utf8');
    proxy = await new GenericContainer('caddy:2.10.2-alpine')
      .withEnvironment({ EMUKEY_DOMAIN: ':80' })
      .withCopyContentToContainer([{ content: caddy.replaceAll('api:3000', `host.testcontainers.internal:${address.port}`), target: '/etc/caddy/Caddyfile' }])
      .withExposedPorts(80).start();
    baseUrl = `http://${proxy.getHost()}:${proxy.getMappedPort(80)}`;
  }, 120_000);
  afterAll(async () => {
    await proxy?.stop();
    if (upstream) { upstream.closeAllConnections(); await new Promise<void>((done) => upstream.close(() => done())); }
  });

  it('passes a document over 1 MiB while retaining the ordinary API limit', async () => {
    const body = Buffer.alloc(1_500_000, 'a');
    const uploaded = await fetch(`${baseUrl}/api/v1/knowledge/documents`, { method: 'POST', body });
    expect(uploaded.status).toBe(200);
    expect(await uploaded.json()).toEqual({ bytes: body.length });
    expect((await fetch(`${baseUrl}/api/v1/conversations`, { method: 'POST', body })).status).toBe(413);
  });

  it('rejects multipart envelopes above 12 MiB before they reach application code', async () => {
    const response = await fetch(`${baseUrl}/api/v1/knowledge/documents`, { method: 'POST', body: Buffer.alloc(12 * 1024 * 1024 + 1, 'a') });
    expect(response.status).toBe(413);
  });
});
