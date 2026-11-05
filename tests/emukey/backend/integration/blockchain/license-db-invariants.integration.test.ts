import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { ActivationDeliveryRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/activation-delivery.repository.js';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { privateKeyToAccount } from 'viem/accounts';

import { ActivationEnvelopeRecoveryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { LicenseQueryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/license-query.service.js';
import { LicensingService } from '../../../../../EmuKey/backend/src/modules/licensing/licensing.service.js';
import { LicensingController } from '../../../../../EmuKey/backend/src/modules/licensing/licensing.controller.js';
import { AuthGuard, OptionalAuthGuard, RolesGuard } from '../../../../../EmuKey/backend/src/modules/identity-access/security.guards.js';
import { ChainCommandRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-command.repository.js';
import { ChainEventRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-event.repository.js';
import { LicensingRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/licensing.repository.js';
import { LicenseProjectionRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/license-projection.repository.js';
import { RedisActivationEnvelope } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { CommerceService } from '../../../../../EmuKey/backend/src/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { FakePaymentGateway } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { seedBaseline } from '../../../../../EmuKey/backend/src/platform/database/seed-baseline.js';

const CHAIN_ID = 11_155_111;
const NETWORK = 'sepolia';
const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000042';
const RECEIPT_BLOCK_HASH = `0x${'ab'.repeat(32)}`;
const DEVICE_JWT_SECRET = new TextEncoder().encode('sepolia-freeze-jwt-secret');
const chainConfig = { chainId: CHAIN_ID, contractAddress: CONTRACT_ADDRESS, network: NETWORK };

const customer = {
  role: 'CUSTOMER' as const,
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000004',
};
const otherCustomer = {
  ...customer,
  sub: '00000000-0000-4000-8000-000000000099',
};
const provider = {
  role: 'PROVIDER_ADMIN' as const,
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000002',
};
const planId = '00000000-0000-4000-8000-000000000301';
const webhookSecret = 'sepolia-freeze-payment-secret';

describe('customer durable license and device invariants without a local blockchain', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let envelopes: RedisActivationEnvelope;
  let commerce: CommerceService;
  let commandRepository: ChainCommandRepository;
  let transactionHash: string;
  let eventRepository: ChainEventRepository;
  let queries: LicenseQueryService;
  let issueCommand: string;
  let licenseId: string;

  async function acceptTerms(orderId: string) {
    const terms = await commerce.getServiceTerms(customer, orderId);
    return commerce.acceptServiceTerms(customer, orderId, {
      accepted: true,
      hash: terms.hash,
      version: terms.version,
    });
  }

  async function activationKey(): Promise<`0x${string}`> {
    const envelope = await envelopes.read(issueCommand);
    if (!envelope) throw new Error('ACTIVATION_ENVELOPE_MISSING');
    return envelope.secret;
  }

  async function ingestEvent(commandId: string, eventType: 'LICENSE_ISSUED' | 'ACTIVE_DEVICE_COUNT_SYNCED') {
    const observed = await eventRepository.ingest({
      blockHash: RECEIPT_BLOCK_HASH,
      blockNumber: 40_000_000,
      chainCommandId: commandId,
      chainId: CHAIN_ID,
      confirmationCount: 2,
      contractAddress: CONTRACT_ADDRESS,
      eventType,
      licenseId,
      logIndex: 0,
      network: NETWORK,
      payload: eventType === 'ACTIVE_DEVICE_COUNT_SYNCED'
        ? { activeDeviceCount: 1, deviceStateVersion: 1 }
        : { activationCommitment: (await envelopes.read(issueCommand))!.commitment, keyVersion: 1,
          expiresAt: (await pool.query('SELECT payload FROM chain_commands WHERE id=$1', [issueCommand])).rows[0].payload.expiresAt },
      providerUserId: provider.sub,
      transactionHash,
    });
    await eventRepository.confirm(observed.id, 2, RECEIPT_BLOCK_HASH);
    return observed.id;
  }

  function licensingService() {
    const projection = new LicenseProjectionRepository(pool);
    return {
      projection,
      service: new LicensingService(
        new LicensingRepository(pool),
        projection,
        envelopes,
        redis,
        DEVICE_JWT_SECRET,
        chainConfig,
        { consumeLicensingActionVerification: async () => undefined } as never,
      ),
    };
  }

  beforeAll(async () => {
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_sepolia_freeze_db')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    const schema = await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8');
    await pool.query(schema);
    await seedBaseline(pool, 'Sepolia-freeze@123');
    redis = new Redis(redisContainer.getConnectionUrl());
    envelopes = new RedisActivationEnvelope(redis, '11'.repeat(32));
    commandRepository = new ChainCommandRepository(pool);
    eventRepository = new ChainEventRepository(pool,new NotificationRepository(pool));
    queries = new LicenseQueryService(
      new LicenseProjectionRepository(pool),
      envelopes,
      redis,
      30,
      new ActivationDeliveryRepository(pool, new LicenseProjectionRepository(pool)),
    );
    commerce = new CommerceService(
      new CommerceRepository(pool, 86_400, new NotificationRepository(pool)),
      new FakePaymentGateway(webhookSecret),
      envelopes,
      new ActivationEnvelopeRecoveryService(commandRepository, envelopes),
      chainConfig,
    );

  }, 120_000);

  beforeEach(async () => {
    const order = await commerce.createOrder(
      customer,
      randomUUID(),
      undefined,
      { planId },
    );
    await acceptTerms(order.id);
    const checkout = await commerce.checkout(customer, order.id);
    const clock = await pool.query<{ occurred_at: Date }>(
      "SELECT statement_timestamp() + interval '1 second' AS occurred_at",
    );
    const payment = await commerce.ingestIpn(
      {
        amountVnd: order.priceVndSnapshot,
        eventId: randomUUID(),
        occurredAt: clock.rows[0]!.occurred_at.toISOString(),
        providerReference: checkout.checkoutReference,
      },
      webhookSecret,
    );
    issueCommand = payment.commandId!;
    licenseId = payment.licenseId!;
    // Persisted repository fixtures only: no RPC, relayer, or blockchain simulator.
    transactionHash = `0x${randomUUID().replaceAll('-', '').repeat(2)}`;
    const relayerAddress = '0x0000000000000000000000000000000000000001';
    const nonce = await commandRepository.reserveNonce(issueCommand, relayerAddress, 0);
    await commandRepository.markPrepared(issueCommand, {
      network: NETWORK, nonce, relayerAddress, rawTransaction: '0x01', transactionHash,
    });
    await commandRepository.markSubmitted(issueCommand);
    await ingestEvent(issueCommand, 'LICENSE_ISSUED');

  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  // Compatibility test for an explicitly supplied archived legacy APK. The
  // current demo calls the provider /verify endpoint and has no activation UI.
  it.runIf(process.env.EMUKEY_ANDROID_SERIAL?.startsWith('emulator-') && process.env.EMUKEY_LEGACY_ANDROID_APK)('runs an archived legacy Kotlin APK through activation, export, restart and revocation against the real local API', async () => {
    const serial = process.env.EMUKEY_ANDROID_SERIAL!;
    const run = promisify(execFile);
    const adb = async (...args: string[]) => (await run(process.env.EMUKEY_ADB ?? 'adb', ['-s', serial, ...args], { windowsHide: true, timeout: 15_000, maxBuffer: 1_000_000 })).stdout;
    const application = 'vn.emukey.licensedemo';
    const { service, projection } = licensingService();
    const module = await Test.createTestingModule({ controllers: [LicensingController], providers: [{ provide: LicensingService, useValue: service }] })
      .overrideGuard(AuthGuard).useValue({ canActivate: () => false })
      .overrideGuard(OptionalAuthGuard).useValue(new OptionalAuthGuard({ authenticate: async () => { throw new Error('Bearer auth is not configured in the device-only fixture'); } } as never))
      .overrideGuard(RolesGuard).useValue({ canActivate: () => false }).compile();
    const app = module.createNestApplication({ logger: false });
    const statuses: string[] = [];
    app.use((req: { path: string }, res: { statusCode: number; on: (event: string, handler: () => void) => void }, next: () => void) => {
      res.on('finish', () => statuses.push(`${req.path}:${res.statusCode}`));
      next();
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as { port: number }).port;
    const steps: string[] = [];
    const tree = async () => {
      await adb('shell', 'rm', '-f', '/data/local/tmp/emukey-license-ui.xml');
      await adb('shell', 'uiautomator', 'dump', '/data/local/tmp/emukey-license-ui.xml');
      try { return await adb('shell', 'cat', '/data/local/tmp/emukey-license-ui.xml'); }
      catch { return ''; }
    };
    const waitText = async (text: string, timeout = 25_000) => {
      try { await expect.poll(async () => {
        if ((await tree()).includes(text)) return true;
        await adb('shell', 'input', 'swipe', '540', '1800', '540', '700', '300');
        return false;
      }, { timeout, interval: 500, message: `Android state: ${text}` }).toBe(true); }
      catch { throw new Error(`Android did not reach "${text}"; steps: ${steps.join(', ')}; HTTP outcomes: ${statuses.slice(-12).join(', ')}`); }
    };
    const tap = async (text: string) => {
      steps.push(text);
      const find = (xml: string) => (xml.match(/<node\b[^>]+>/g) ?? []).find((value) => value.includes(`text="${text}"`) || value.includes(`content-desc="${text}"`));
      let node = find(await tree());
      if (!node) {
        await adb('shell', 'input', 'swipe', '540', '650', '540', '1800', '300');
        node = find(await tree());
      }
      const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!bounds) throw new Error(`Missing Android control: ${text}`);
      await adb('shell', 'input', 'tap', String((Number(bounds[1]) + Number(bounds[3])) / 2), String((Number(bounds[2]) + Number(bounds[4])) / 2));
    };
    const edit = async (index: number, value: string) => {
      const fields = ((await tree()).match(/<node\b[^>]+>/g) ?? []).filter((node) => node.includes('class="android.widget.EditText"'));
      const bounds = fields[index]?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!bounds) throw new Error(`Missing Android input ${index}`);
      await adb('shell', 'input', 'tap', String((Number(bounds[1]) + Number(bounds[3])) / 2), String((Number(bounds[2]) + Number(bounds[4])) / 2));
      await adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
      await adb('shell', 'input', 'keyevent', ...Array<string>(100).fill('KEYCODE_DEL'));
      await adb('shell', 'input', 'text', value);
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    };
    const launch = async () => {
      await adb('shell', 'am', 'start', '-n', `${application}/.MainActivity`);
      await waitText('Thiết bị đã sẵn sàng.');
    };
    const downloads = async () => (await adb('shell', 'ls', '/sdcard/Download')).split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    let initialDownloads: Set<string> | undefined;
    let serverClosed = false;
    const createdReports = async () => (await downloads()).filter((name) => /^emukey-demo(?: ?\(\d+\))?\.csv$/.test(name) && initialDownloads && !initialDownloads.has(name));
    const saveReport = async () => {
      await tap('Kiểm tra quyền và xuất báo cáo');
      await waitText('SAVE');
      await tap('SAVE');
    };
    try {
      initialDownloads = new Set(await downloads());
      await adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
      await adb('shell', 'wm', 'dismiss-keyguard');
      await adb('shell', 'svc', 'power', 'stayon', 'true');
      await adb('install', '-r', process.env.EMUKEY_LEGACY_ANDROID_APK!);
      await adb('shell', 'pm', 'clear', application);
      await launch();
      await edit(0, `http://10.0.2.2:${port}/api/v1`);
      await tap('Lưu máy chủ');
      await waitText('Đã lưu máy chủ.');
      await tap('Kiểm tra quyền và xuất báo cáo');
      await waitText('Thiết bị chưa được kích hoạt');
      expect(await createdReports()).toEqual([]);
      expect(await tree()).not.toContain('text="SAVE"');
      await edit(1, await activationKey());
      await tap('Kích hoạt thiết bị');
      await waitText('Đã liên kết thiết bị.');
      const [device] = await projection.listCustomerDevices(customer.sub, licenseId);
      expect(device).toMatchObject({ status: 'ACTIVE' });
      await tap('Kiểm tra quyền');
      await waitText('Bản quyền hợp lệ, có quyền desktop');
      await saveReport();
      await waitText('Đã kiểm tra quyền trực tuyến và xuất báo cáo demo.');
      const [report] = await createdReports();
      expect(report).toBeDefined();
      expect((await adb('shell', 'cat', `'/sdcard/Download/${report}'`)).replaceAll('\r\n', '\n')).toBe('product,result\nEmuKey,licensed report\n');
      const encrypted = await adb('shell', 'run-as', application, 'cat', 'shared_prefs/emukey_device.xml');
      expect(encrypted).toContain('ciphertext');
      expect(encrypted).toContain('iv');
      expect(encrypted).not.toContain('privateKey');
      expect(encrypted).not.toContain(await activationKey());
      await adb('shell', 'am', 'force-stop', application);
      await launch();
      await tap('Kiểm tra quyền');
      await waitText('Bản quyền hợp lệ, có quyền desktop');
      expect(await projection.listCustomerDevices(customer.sub, licenseId)).toEqual([device]);
      await new LicensingRepository(pool).createDeviceRevokeCommand(customer.sub, licenseId, device!.deviceRef, device!.id, device!.bindingGeneration, chainConfig);
      await tap('Kiểm tra quyền');
      await waitText('Quyền sử dụng chưa hợp lệ');
      const beforeDenied = statuses.length;
      await tap('Kiểm tra quyền và xuất báo cáo');
      await expect.poll(() => statuses.slice(beforeDenied).some((outcome) => outcome.endsWith(':409')), { timeout: 15_000 }).toBe(true);
      await waitText('Quyền sử dụng chưa hợp lệ');
      expect(await createdReports()).toEqual([report]);
      expect(await tree()).not.toContain('text="SAVE"');
      await app.close();
      serverClosed = true;
      await tap('Kiểm tra quyền');
      await waitText('Kiểm tra kết nối');
    } finally {
      if (!serverClosed) await app.close();
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      await adb('shell', 'am', 'force-stop', application);
      await adb('shell', 'rm', '-f', '/data/local/tmp/emukey-license-ui.xml');
      await adb('shell', 'svc', 'power', 'stayon', 'false');
      if (initialDownloads) for (const report of await createdReports()) await adb('shell', 'rm', '-f', `'/sdcard/Download/${report}'`);
    }
  }, 240_000);

  it.runIf(process.env.EMUKEY_MANAGER_ANDROID_SERIAL?.startsWith('emulator-') && process.env.EMUKEY_MANAGER_ANDROID_APK)(
    'runs the manager Android app through login, SecureStore key receipt, restart, account switch and revocation', async () => {
    const serial = process.env.EMUKEY_MANAGER_ANDROID_SERIAL!;
    const application = 'app.emukey.mobile';
    const run = promisify(execFile);
    const adb = async (...args: string[]) => (await run(process.env.EMUKEY_ADB ?? 'adb', ['-s', serial, ...args], { windowsHide: true, timeout: 20_000, maxBuffer: 1_000_000 })).stdout;
    if ((await adb('shell', 'pm', 'list', 'packages', application)).includes(`package:${application}`)) throw new Error('Use a disposable emulator without an existing manager installation');
    const file = `/data/local/tmp/emukey-manager-${randomUUID()}.xml`;
    const tree = async () => {
      await adb('shell', 'uiautomator', 'dump', file);
      return adb('shell', 'cat', file);
    };
    const normalize = (value: string) => value.toLocaleLowerCase('vi-VN');
    const waitText = (text: string) => expect.poll(async () => normalize(await tree()).includes(normalize(text)), { timeout: 35_000, interval: 500, message: `Manager Android: ${text}` }).toBe(true);
    const tap = async (text: string) => {
      let node: string | undefined;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        node = ((await tree()).match(/<node\b[^>]+>/g) ?? []).find((value) => normalize(value).includes(`text="${normalize(text)}"`) || normalize(value).includes(`content-desc="${normalize(text)}"`));
        if (node) break;
        await adb('shell', 'input', 'swipe', '540', '1700', '540', '650', '250');
      }
      const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!bounds) throw new Error(`Manager Android control unavailable: ${text}`);
      await adb('shell', 'input', 'tap', String((Number(bounds[1]) + Number(bounds[3])) / 2), String((Number(bounds[2]) + Number(bounds[4])) / 2));
    };
    const login = async (email: string) => {
      await waitText('Đăng nhập');
      for (const [label, value] of [['Email', email], ['Mật khẩu', 'Sepolia-freeze@123']]) {
        await tap(label); await adb('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A');
        await adb('shell', 'input', 'text', value); await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      }
      const emailNode = ((await tree()).match(/<node\b[^>]+>/g) ?? []).find((node) => node.includes('content-desc="Email"'));
      expect(emailNode?.match(/text="([^"]*)"/)?.[1]).toBe(email);
      await tap('Đăng nhập'); await waitText('Danh mục sản phẩm');
    };
    const patch = { NODE_ENV: 'test', PORT: '43170', DATABASE_URL: postgres.getConnectionUri(), REDIS_URL: redisContainer.getConnectionUrl(),
      CORS_ORIGINS: 'http://localhost:43170', LOG_LEVEL: 'fatal', OTEL_ENABLED: 'false', PAYMENT_ADAPTER: 'fake', PAYMENT_WEBHOOK_SECRET: webhookSecret,
      SEPAY_SANDBOX_RECEIPT_TIMING: 'false', AI_ADAPTER: 'fake', EMAIL_ADAPTER: 'fake', PUSH_ADAPTER: 'fake', EVM_ADAPTER: 'viem',
      EVM_NETWORK: NETWORK, EVM_CHAIN_ID: String(CHAIN_ID), EVM_CONFIRMATIONS: '2', EVM_CONTRACT_ADDRESS: CONTRACT_ADDRESS,
      EVM_DEPLOYMENT_BLOCK: '1', EVM_INDEXER_BATCH_SIZE: '500', EVM_RPC_HTTP_URL: 'http://127.0.0.1:1', EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
      STORAGE_ADAPTER: 'local', ACTIVATION_ENVELOPE_ADAPTER: 'redis', ACTIVATION_ENVELOPE_KEY: '11'.repeat(32), JWT_SECRET: 'android-manager-fixture-jwt-secret-32-characters' };
    const saved = new Map(Object.keys(patch).map((key) => [key, process.env[key]]));
    Object.assign(process.env, patch);
    let installed = false;
    let app: Awaited<ReturnType<typeof import('../../../../../EmuKey/backend/src/entrypoints/api/create-api-application.js')['createApiApplication']>> | undefined;
    const outcomes: string[] = [];
    try {
      const { createApiApplication } = await import('../../../../../EmuKey/backend/src/entrypoints/api/create-api-application.js');
      app = await createApiApplication({ logger: false });
      app.use((req: { method: string; path: string }, res: { statusCode: number; on: (event: string, fn: () => void) => void }, next: () => void) => {
        res.on('finish', () => outcomes.push(`${req.method} ${req.path} ${res.statusCode}`)); next();
      });
      await app.listen(43170, '0.0.0.0');
        // This fixture checks session/key storage, not the OS push-permission UX.
        await adb('install', '-g', process.env.EMUKEY_MANAGER_ANDROID_APK!); installed = true;
      const launch = () => adb('shell', 'am', 'start', '-n', `${application}/.MainActivity`);
      await adb('shell', 'wm', 'dismiss-keyguard');
      await launch(); await login('customer@example.test');
      await tap('License'); await waitText('License doanh nghiệp');
      await tap('Nhận mã bản quyền'); await waitText('Mã bản quyền');
      const receipt = (await pool.query('SELECT delivery_id,acknowledged_at FROM license_key_deliveries WHERE license_id=$1', [licenseId])).rows;
      expect(receipt).toHaveLength(1); expect(receipt[0].acknowledged_at).not.toBeNull();
      await adb('shell', 'am', 'force-stop', application); await launch(); await waitText('Danh mục sản phẩm');
      await tap('License'); await tap('Xem mã đã lưu'); await waitText('Mã bản quyền');
      expect(outcomes.filter((value) => value.includes('/activation-key/retrieve '))).toHaveLength(1);
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await tap('Đăng xuất'); await waitText('Đăng nhập');
      const second = randomUUID();
      const email = `android-${second}@example.test`;
      await pool.query(`INSERT INTO users(id,email,password_hash,display_name,role,status,customer_type,email_verified_at)
        SELECT $1,$2,password_hash,'Manager other account','CUSTOMER','ACTIVE','INDIVIDUAL',now() FROM users WHERE id=$3`, [second, email, customer.sub]);
      await login(email); await tap('License'); await waitText('Chưa có License nào.');
      expect((await tree()).includes('content-desc="Mã bản quyền"')).toBe(false);
      await pool.query('UPDATE users SET session_version=session_version+1 WHERE id=$1', [second]);
        // The private screen's notification poll observes revocation and can
        // remove navigation before another tap. Wait for that real transition.
        await waitText('Đăng nhập');
      await adb('shell', 'am', 'force-stop', application); await launch(); await waitText('Đăng nhập');
      expect(outcomes.some((value) => value.includes('/auth/mobile/refresh 401'))).toBe(true);
      } catch (error) {
        const controls = ((await tree()).match(/<node\b[^>]+>/g) ?? []).filter((node) => !node.includes('class="android.widget.EditText"'))
          .map((node) => node.match(/text="([^"]*)"/)?.[1]).filter(Boolean);
        throw new Error(`Manager Android failed: ${String(error)}; HTTP outcomes: ${outcomes.slice(-16).join(', ')}; visible controls: ${controls.join(' | ')}`, { cause: error });
      }
    finally {
      if (installed) await adb('uninstall', application);
      await adb('shell', 'rm', '-f', file);
      await app?.close();
      for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  }, 360_000);

  it('enforces one-time retrieval and customer ownership', async () => {
    const deliveryId = randomUUID();
    const retrieved = await queries.retrieveActivation(customer, licenseId, deliveryId);
    expect(retrieved.activationKey).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(queries.retrieveActivation(customer, licenseId, deliveryId)).resolves.toEqual(retrieved);
    await queries.acknowledgeActivation(customer, licenseId, deliveryId, retrieved.keyVersion);
    await expect(queries.retrieveActivation(customer, licenseId, deliveryId)).rejects.toMatchObject({ status: 404 });
    await expect(queries.find(otherCustomer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(queries.list(otherCustomer)).resolves.toEqual([]);
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ id: licenseId, status: 'ACTIVE' });
  });

  it('deduplicates expiry windows, invalidates the old reminder after canonical renewal and creates the next-period reminder', async () => {
    const expiry = (await pool.query<{ expires_at: Date }>('SELECT expires_at FROM licenses WHERE id=$1', [licenseId])).rows[0]!.expires_at;
    // Advance only the reminder selector's clock. Domain rows, schema guards,
    // payment time and canonical event transitions stay unchanged.
    let reminderClock = new Date(expiry.getTime() - 6 * 86_400_000);
    const reminders = new NotificationRepository({
      query: pool.query.bind(pool),
      connect: async () => {
        const connection = await pool.connect();
        return {
          query: (sql: string, parameters?: unknown[]) => connection.query(
            sql.includes('FROM licenses l CROSS JOIN') ? sql.replaceAll('statement_timestamp()', `'${reminderClock.toISOString()}'::timestamptz`) : sql, parameters),
          release: () => connection.release(),
        };
      },
    } as unknown as Pool);
    await reminders.createExpiryReminders();
    expect(await reminders.createExpiryReminders()).toBe(0);
    const old = (await pool.query("SELECT id,event_key FROM notifications WHERE type='LICENSE_EXPIRING' AND data->>'licenseId'=$1", [licenseId])).rows;
    expect(old).toHaveLength(1);
    expect(old[0].event_key).toBe(`expiry:${licenseId}:${expiry.toISOString()}:7`);
    expect(await reminders.deliveryIsCurrent(old[0].id)).toBe(true);

    const renewal = await commerce.createOrder(customer, randomUUID(), undefined, { planId, targetLicenseId: licenseId });
    await acceptTerms(renewal.id);
    const checkout = await commerce.checkout(customer, renewal.id);
    const paymentTime = (await pool.query<{ occurred_at: Date }>("SELECT statement_timestamp()+interval '1 second' AS occurred_at")).rows[0]!.occurred_at;
    const paid = await commerce.ingestIpn({ amountVnd: renewal.priceVndSnapshot, eventId: randomUUID(), occurredAt: paymentTime.toISOString(), providerReference: checkout.checkoutReference }, webhookSecret);
    const payload = (await pool.query('SELECT payload FROM chain_commands WHERE id=$1', [paid.commandId])).rows[0].payload;
    const hash = `0x${randomUUID().replaceAll('-', '').repeat(2)}`;
    const relayerAddress = '0x0000000000000000000000000000000000000001';
    const nonce = await commandRepository.reserveNonce(paid.commandId!, relayerAddress, 0);
    await commandRepository.markPrepared(paid.commandId!, { network: NETWORK, nonce, relayerAddress, rawTransaction: '0x01', transactionHash: hash });
    await commandRepository.markSubmitted(paid.commandId!);
    const renewed = await eventRepository.ingest({ blockHash: RECEIPT_BLOCK_HASH, blockNumber: 40_000_001, chainCommandId: paid.commandId!, chainId: CHAIN_ID, confirmationCount: 2,
      contractAddress: CONTRACT_ADDRESS, eventType: 'LICENSE_RENEWED', licenseId, logIndex: 0, network: NETWORK, payload: { expiresAt: payload.expiresAt }, providerUserId: provider.sub, transactionHash: hash });
    await eventRepository.confirm(renewed.id, 2, RECEIPT_BLOCK_HASH);
    expect(await reminders.deliveryIsCurrent(old[0].id)).toBe(false);
    expect(await reminders.find(customer.sub, old[0].id)).toBeNull();
    expect(await reminders.createExpiryReminders()).toBe(0);
    reminderClock = new Date(new Date(payload.expiresAt).getTime() - 12 * 3_600_000);
    await reminders.createExpiryReminders();
    expect(await reminders.createExpiryReminders()).toBe(0);
    const periods = (await pool.query("SELECT id,event_key FROM notifications WHERE type='LICENSE_EXPIRING' AND data->>'licenseId'=$1 ORDER BY created_at,id", [licenseId])).rows;
    expect(periods).toHaveLength(2);
    expect(periods.some((row) => row.event_key === `expiry:${licenseId}:${new Date(payload.expiresAt).toISOString()}:1`)).toBe(true);
    await eventRepository.markReorged(renewed.id);
    expect((await pool.query('SELECT expires_at FROM licenses WHERE id=$1', [licenseId])).rows[0].expires_at).toEqual(expiry);
    reminderClock = new Date(expiry.getTime() - 6 * 86_400_000);
    await reminders.createExpiryReminders();
    expect(await reminders.find(customer.sub, old[0].id)).toBeTruthy();
    expect((await pool.query("SELECT id FROM notifications WHERE type='LICENSE_EXPIRING' AND data->>'licenseId'=$1", [licenseId])).rows).toHaveLength(2);
  });

  it('admits one delivery ID, preserves retry after a lost response, and keeps ACK closed after Redis deletion fails', async () => {
    const first = randomUUID();
    const second = randomUUID();
    const claims = await Promise.allSettled([queries.retrieveActivation(customer, licenseId, first), queries.retrieveActivation(customer, licenseId, second)]);
    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    const winner = claims.find((claim) => claim.status === 'fulfilled')!;
    if (winner.status !== 'fulfilled') throw new Error('Missing winning delivery');
    const result = winner.value;
    await expect(queries.retrieveActivation(customer, licenseId, result.deliveryId)).resolves.toEqual(result);
    await expect(queries.acknowledgeActivation(otherCustomer, licenseId, result.deliveryId, result.keyVersion)).rejects.toBeDefined();
    const consume = vi.spyOn(envelopes, 'consume').mockRejectedValueOnce(new Error('Redis offline'));
    try { await queries.acknowledgeActivation(customer, licenseId, result.deliveryId, result.keyVersion); }
    finally { consume.mockRestore(); }
    expect(await envelopes.exists(issueCommand)).toBe(true);
    await expect(queries.retrieveActivation(customer, licenseId, result.deliveryId)).rejects.toMatchObject({ status: 409 });
    await expect(queries.acknowledgeActivation(customer, licenseId, result.deliveryId, result.keyVersion)).resolves.toEqual({ acknowledged: true });
    expect(await envelopes.exists(issueCommand)).toBe(false);
  });

  it('preserves the receipt through envelope loss and refuses a Redis backup replay after ACK', async () => {
    const key = `activation-envelope:${issueCommand}`;
    const backup = await redis.dumpBuffer(key);
    const ttl = await redis.pttl(key);
    expect(backup).not.toBeNull();
    const deliveryId = randomUUID();
    const first = await queries.retrieveActivation(customer, licenseId, deliveryId);
    await redis.del(key); // Only the envelope created by this test's order.
    await expect(queries.retrieveActivation(customer, licenseId, deliveryId)).rejects.toMatchObject({ status: 404 });
    expect((await queries.find(customer, licenseId)).activationKeyAvailable).toBe(false);
    await redis.restore(key, ttl, backup!);
    await expect(queries.retrieveActivation(customer, licenseId, deliveryId)).resolves.toEqual(first);
    await expect(queries.retrieveActivation(customer, licenseId, randomUUID())).rejects.toMatchObject({ response: { code: 'KEY_ALREADY_DELIVERED' } });
    await expect(queries.retrieveActivation(otherCustomer, licenseId, deliveryId)).rejects.toMatchObject({ status: 404 });
    await queries.acknowledgeActivation(customer, licenseId, deliveryId, first.keyVersion);
    const acknowledged = (await pool.query('SELECT acknowledged_at,retry_until FROM license_key_deliveries WHERE license_id=$1', [licenseId])).rows[0];
    await redis.restore(key, ttl, backup!);
    expect((await queries.find(customer, licenseId)).activationKeyAvailable).toBe(false);
    for (const id of [deliveryId, randomUUID()]) {
      await expect(queries.retrieveActivation(customer, licenseId, id)).rejects.toMatchObject({ response: { code: 'KEY_ALREADY_DELIVERED' } });
    }
    await expect(queries.acknowledgeActivation(customer, licenseId, deliveryId, first.keyVersion)).resolves.toEqual({ acknowledged: true });
    expect(await redis.exists(key)).toBe(0);
    expect((await pool.query('SELECT acknowledged_at,retry_until FROM license_key_deliveries WHERE license_id=$1', [licenseId])).rows).toEqual([acknowledged]);
  });

  it('does not extend an expired receipt when an encrypted Redis backup has a fresh TTL', async () => {
    const key = `activation-envelope:${issueCommand}`;
    const backup = await redis.dumpBuffer(key);
    const deliveries = new ActivationDeliveryRepository(pool, new LicenseProjectionRepository(pool));
    const deliveryId = randomUUID();
    await deliveries.claim({ licenseId, customerId: customer.sub, commandId: issueCommand, keyVersion: 1, deliveryId, ttlSeconds: 1 });
    await pool.query('SELECT pg_sleep(1.1)');
    await redis.del(key);
    await redis.restore(key, 30_000, backup!);
    await expect(queries.retrieveActivation(customer, licenseId, deliveryId)).rejects.toMatchObject({ response: { code: 'KEY_DELIVERY_EXPIRED' } });
    await expect(queries.retrieveActivation(customer, licenseId, randomUUID())).rejects.toMatchObject({ response: { code: 'KEY_ALREADY_DELIVERED' } });
    expect((await queries.find(customer, licenseId)).activationKeyAvailable).toBe(false);
    expect((await pool.query('SELECT delivery_id FROM license_key_deliveries WHERE license_id=$1', [licenseId])).rows).toEqual([{ delivery_id: deliveryId }]);
  });

  it('rechecks the canonical key version at the durable receipt boundary', async () => {
    const deliveries = new ActivationDeliveryRepository(pool, new LicenseProjectionRepository(pool));
    await expect(deliveries.claim({ licenseId, customerId: customer.sub, commandId: issueCommand,
      keyVersion: 2, deliveryId: randomUUID(), ttlSeconds: 60 })).rejects.toMatchObject({ status: 409 });
    expect((await pool.query('SELECT license_id FROM license_key_deliveries WHERE license_id=$1', [licenseId])).rows).toHaveLength(0);
  });

  it('reports an expired delivery retry window without opening a second receipt', async () => {
    const deliveries = new ActivationDeliveryRepository(pool, new LicenseProjectionRepository(pool));
    const input = { licenseId, customerId: customer.sub, commandId: issueCommand, keyVersion: 1, deliveryId: randomUUID(), ttlSeconds: 1 };
    await deliveries.claim(input);
    await pool.query('SELECT pg_sleep(1.1)');
    await expect(deliveries.claim(input)).rejects.toMatchObject({ response: { code: 'KEY_DELIVERY_EXPIRED' } });
    await expect(deliveries.claim({ ...input, deliveryId: randomUUID() })).rejects.toMatchObject({ response: { code: 'KEY_ALREADY_DELIVERED' } });
    expect((await pool.query('SELECT delivery_id FROM license_key_deliveries WHERE license_id=$1', [licenseId])).rows).toEqual([{ delivery_id: input.deliveryId }]);
  });

  it('creates finality notifications once and invalidates their delivery after reorg', async () => {
    const notifications = new NotificationRepository(pool);
    const rows = await pool.query("SELECT id FROM notifications WHERE type='LICENSE_CONFIRMED' AND data->>'licenseId'=$1", [licenseId]);
    expect(rows.rows).toHaveLength(1);
    expect(await notifications.deliveryIsCurrent(rows.rows[0].id)).toBe(true);
    // Re-ingestion of the same canonical event cannot produce another notification.
    const eventId = await ingestEvent(issueCommand, 'LICENSE_ISSUED');
    expect((await pool.query("SELECT id FROM notifications WHERE type='LICENSE_CONFIRMED' AND data->>'licenseId'=$1", [licenseId])).rows).toHaveLength(1);
    await eventRepository.markReorged(eventId);
    expect(await notifications.deliveryIsCurrent(rows.rows[0].id)).toBe(false);
    expect((await pool.query("SELECT id FROM notifications WHERE type='LICENSE_STATUS_RECHECK' AND data->>'licenseId'=$1", [licenseId])).rows).toHaveLength(1);
  });

  it('keeps lifecycle commands on the original issuance registry after configuration changes', async () => {
    const command = await new LicensingRepository(pool).createLifecycleCommand(provider.sub, licenseId, 'SUSPEND_LICENSE', { ...chainConfig, contractAddress: `0x${'78'.repeat(20)}` });
    expect((await pool.query('SELECT contract_address, network, chain_id FROM chain_commands WHERE id=$1', [command.commandId])).rows[0]).toMatchObject({ contract_address: CONTRACT_ADDRESS, network: NETWORK, chain_id: String(CHAIN_ID) });
  });

  it('rejects replay and keeps same-device activation idempotent', async () => {
    const { projection, service } = licensingService();
    const key = await activationKey();
    const account = privateKeyToAccount(`0x${'55'.repeat(32)}`);
    const deviceRef = 'sepolia-freeze-device-1';
    const firstChallenge = await service.challenge(null, {
      activationKey: key,
      deviceRef,
      licenseId,
      purpose: 'ACTIVATE_DEVICE',
    });
    const firstProof = await account.signMessage({ message: firstChallenge.challenge });
    await expect(service.activate(null, {
      activationKey: key,
      challenge: firstChallenge.challenge,
      devicePublicKey: account.address,
      deviceRef,
      licenseId,
      proof: firstProof,
    })).resolves.toMatchObject({ licenseId, status: 'ACTIVE' });
    await expect(projection.findCustomer(customer.sub, licenseId)).resolves.toMatchObject({ activeDeviceCount: 1 });
    // Replaying the consumed challenge and proof must be rejected.
    await expect(service.activate(null, {
      activationKey: key,
      challenge: firstChallenge.challenge,
      devicePublicKey: account.address,
      deviceRef,
      licenseId,
      proof: firstProof,
    })).rejects.toMatchObject({ status: 401 });
    expect(await projection.listCustomerDevices(customer.sub, licenseId)).toHaveLength(1);


    const repeatedChallenge = await service.challenge(null, {
      activationKey: key, deviceRef, licenseId, purpose: 'ACTIVATE_DEVICE',
    });
    const repeated = await service.activate(null, {
      activationKey: key, deviceRef, licenseId, challenge: repeatedChallenge.challenge,
      devicePublicKey: account.address, proof: await account.signMessage({ message: repeatedChallenge.challenge }),
    });
    expect(repeated).not.toHaveProperty('commandId');
    const device = (await projection.listCustomerDevices(customer.sub, licenseId))[0]!;
    const directRepeat = await new LicensingRepository(pool).createDeviceCommand(
      null, licenseId, device.deviceRef, account.address, randomUUID(), 1, chainConfig,
    );
    expect(directRepeat.commandId).toBeNull();
    expect(await projection.listCustomerDevices(customer.sub, licenseId)).toHaveLength(1);
    expect((await pool.query('SELECT active_device_count, device_state_version FROM licenses WHERE id=$1', [licenseId])).rows[0])
      .toMatchObject({ active_device_count: 1, device_state_version: '1' });
  });

  it('serializes three concurrent activations against the Starter quota of one', async () => {
    const { projection, service } = licensingService();
    const key = await activationKey();
    const concurrent = await Promise.allSettled(
      ['66', '77', '99'].map(async (byte, index) => {
        const concurrentAccount = privateKeyToAccount(`0x${byte.repeat(32)}`);
        const concurrentRef = `sepolia-freeze-concurrent-${index}`;
        const challenge = await service.challenge(null, {
          activationKey: key,
          deviceRef: concurrentRef,
          licenseId,
          purpose: 'ACTIVATE_DEVICE',
        });
        return service.activate(null, {
          activationKey: key,
          challenge: challenge.challenge,
          devicePublicKey: concurrentAccount.address,
          deviceRef: concurrentRef,
          licenseId,
          proof: await concurrentAccount.signMessage({ message: challenge.challenge }),
        });
      }),
    );
    expect(concurrent.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter(({ status }) => status === 'rejected')).toHaveLength(2);

    const failure = concurrent.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ status: 409 });
    const devices = await projection.listCustomerDevices(customer.sub, licenseId);
    expect(devices).toHaveLength(1);
    const afterState = await pool.query<{ active_device_count: number; device_state_version: string; latest_requested_device_sync_version: string }>(
      `SELECT active_device_count, device_state_version,
              latest_requested_device_sync_version
       FROM licenses WHERE id=$1`,
      [licenseId],
    );
    expect(afterState.rows[0]).toMatchObject({ active_device_count: 1 });
    expect(BigInt(afterState.rows[0]!.device_state_version)).toBe(1n);
    expect(BigInt(afterState.rows[0]!.latest_requested_device_sync_version)).toBe(BigInt(afterState.rows[0]!.device_state_version));
    const syncCommands = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM chain_commands WHERE license_id=$1 AND command_type='SYNC_DEVICE_COUNT'",
      [licenseId],
    );
    expect(syncCommands.rows[0]!.count).toBe(1);
  });

  it('keeps owner isolation and device activation independent of chain finality', async () => {
    const { projection, service } = licensingService();
    const key = await activationKey();
    const account = privateKeyToAccount(`0x${'88'.repeat(32)}`);
    const deviceRef = 'sepolia-freeze-other-device';
    const challenge = await service.challenge(otherCustomer, {
      activationKey: key,
      deviceRef,
      licenseId,
      purpose: 'ACTIVATE_DEVICE',
    });
    await expect(service.activate(otherCustomer, {
      activationKey: key,
      challenge: challenge.challenge,
      devicePublicKey: account.address,
      deviceRef,
      licenseId,
      proof: await account.signMessage({ message: challenge.challenge }),
    })).resolves.toMatchObject({ licenseId, status: 'ACTIVE' });

    expect((await pool.query('SELECT customer_user_id FROM licenses WHERE id=$1', [licenseId])).rows[0]).toMatchObject({
      customer_user_id: customer.sub,
    });
    await expect(queries.list(otherCustomer)).resolves.toEqual([]);
    await expect(queries.find(otherCustomer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(queries.retrieveActivation(otherCustomer, licenseId, randomUUID())).rejects.toMatchObject({ status: 404 });
    await expect(service.rotate(otherCustomer, licenseId, { currentKey: key, actionToken: 'unused' })).rejects.toMatchObject({ status: 404 });
    await expect(service.recoverActivationKey(otherCustomer, licenseId, { currentPassword: 'unused', actionToken: 'unused' })).rejects.toMatchObject({ status: 404 });

    const devices = await projection.listCustomerDevices(customer.sub, licenseId);
    const storedDeviceRef = createHmac('sha256', DEVICE_JWT_SECRET).update(`device-ref:${deviceRef}`).digest('hex');
    const device = devices.find((candidate) => candidate.deviceRef === storedDeviceRef)!;
    expect(device.status).toBe('ACTIVE');
    const revokeChallenge = await service.challenge(customer, {
      deviceId: device.id,
      deviceRef: storedDeviceRef,
      licenseId,
      purpose: 'SELF_REVOKE_DEVICE',
    });
    await service.revokeDevice(customer, licenseId, device.id, {
      activationKey: key,
      actionToken: 'test-action-token',
      challenge: revokeChallenge.challenge,
      proof: await account.signMessage({ message: revokeChallenge.challenge }),
    });
    await expect(projection.findCustomer(customer.sub, licenseId)).resolves.toMatchObject({ activeDeviceCount: 0 });
    await expect(projection.listCustomerDevices(customer.sub, licenseId)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ deviceRef: storedDeviceRef, status: 'REVOKED' }),
    ]));
    const rebind = await service.challenge(null, { activationKey: key, deviceRef, licenseId, purpose: 'ACTIVATE_DEVICE' });
    expect(rebind.bindingGeneration).toBe(2);
    await expect(service.activate(null, { activationKey: key, deviceRef, licenseId,
      devicePublicKey: account.address, challenge: rebind.challenge,
      proof: await account.signMessage({ message: rebind.challenge }),
    })).resolves.toMatchObject({ id: device.id, status: 'ACTIVE', bindingGeneration: 2 });
    await expect(projection.findCustomer(customer.sub, licenseId)).resolves.toMatchObject({ activeDeviceCount: 1 });
    expect((await pool.query('SELECT active_device_count FROM licenses WHERE id=$1', [licenseId])).rows[0].active_device_count).toBe(1);
    expect((await pool.query("SELECT DISTINCT status FROM chain_commands WHERE license_id=$1 AND command_type='SYNC_DEVICE_COUNT'", [licenseId])).rows)
      .toEqual([{ status: 'PENDING' }]);

  });

  it('rolls back device changes and their projected count together when device-sync persistence fails', async () => {
    const projection = new LicenseProjectionRepository(pool);
    const repository = new LicensingRepository(pool);
    const deviceId = randomUUID();
    const deviceRef = 'rollback-device';
    const account = privateKeyToAccount(`0x${'55'.repeat(32)}`);
    await pool.query(`CREATE FUNCTION test_fail_device_sync() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'SYNC_UNAVAILABLE'; END; $$`);
    const failSync = () => pool.query(`CREATE TRIGGER test_fail_device_sync
      BEFORE INSERT OR UPDATE ON chain_commands FOR EACH ROW
      WHEN (NEW.command_type = 'SYNC_DEVICE_COUNT' AND NEW.license_id = '${licenseId}'::uuid)
      EXECUTE FUNCTION test_fail_device_sync()`);
    try {
      await failSync();
      await expect(repository.createDeviceCommand(null, licenseId, deviceRef, account.address, deviceId, 1, chainConfig))
        .rejects.toThrow('SYNC_UNAVAILABLE');
      await expect(projection.findCustomer(customer.sub, licenseId)).resolves.toMatchObject({ activeDeviceCount: 0 });
      await expect(projection.listCustomerDevices(customer.sub, licenseId)).resolves.toEqual([]);
      await pool.query('DROP TRIGGER test_fail_device_sync ON chain_commands');
      await repository.createDeviceCommand(null, licenseId, deviceRef, account.address, deviceId, 1, chainConfig);
      await failSync();
      await expect(repository.createDeviceRevokeCommand(customer.sub, licenseId, deviceRef, deviceId, 1, chainConfig))
        .rejects.toThrow('SYNC_UNAVAILABLE');
      await expect(projection.findCustomer(customer.sub, licenseId)).resolves.toMatchObject({ activeDeviceCount: 1 });
      await expect(projection.listCustomerDevices(customer.sub, licenseId)).resolves.toEqual([
        expect.objectContaining({ id: deviceId, status: 'ACTIVE' }),
      ]);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS test_fail_device_sync ON chain_commands');
      await pool.query('DROP FUNCTION test_fail_device_sync()');
    }
  });

  it('repairs persisted canonical projection drift without a chain node', async () => {
    const corruption = await pool.connect();
    try {
      await corruption.query('SET session_replication_role = replica');
      await corruption.query(
        `UPDATE chain_commands SET status='SUBMITTED_UNKNOWN', confirmed_at=NULL,
           confirmation_chain_event_id=NULL WHERE id=$1`,
        [issueCommand],
      );
    } finally {
      await corruption.query('SET session_replication_role = origin');
      corruption.release();
    }
    const repair = await eventRepository.reconcileCanonicalProjections();
    expect(repair).toMatchObject({
      commandRepairs: 1,
      licenseIds: [],
      licenseRepairs: 0,
      remainingMismatches: 0,
    });
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ id: licenseId, status: 'ACTIVE' });
  });

  it.each(['ACTIVE', 'PENDING_ONCHAIN'])('preserves PostgreSQL expiry precision while reconciling %s issuance', async (status) => {
    const fixture=await pool.connect();
    try {
      await fixture.query('SET session_replication_role = replica');
      await fixture.query("UPDATE licenses SET expires_at=date_trunc('second',expires_at)+interval '0.123456 seconds',status=$2::varchar,activation_key_trust_status=CASE WHEN $2::varchar='PENDING_ONCHAIN' THEN 'PENDING_FINALITY' ELSE 'TRUSTED' END,last_applied_chain_event_id=CASE WHEN $2::varchar='PENDING_ONCHAIN' THEN NULL ELSE last_applied_chain_event_id END WHERE id=$1",[licenseId,status]);
      await fixture.query("UPDATE chain_commands c SET payload=jsonb_set(payload,'{expiresAt}',to_jsonb(to_char(l.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))) FROM licenses l WHERE c.id=$1 AND l.id=c.license_id",[issueCommand]);
      if(status==='PENDING_ONCHAIN') {
        await fixture.query("UPDATE chain_commands SET status='SUBMITTED',confirmed_at=NULL,confirmation_chain_event_id=NULL WHERE id=$1",[issueCommand]);
        await fixture.query("UPDATE chain_events SET finality_status='PENDING',finalized_at=NULL WHERE chain_command_id=$1",[issueCommand]);
      }
      await fixture.query('SET session_replication_role = origin');
      const before=(await fixture.query('SELECT expires_at::text FROM licenses WHERE id=$1',[licenseId])).rows[0].expires_at;
      await expect(eventRepository.reconcileCanonicalProjections()).resolves.toMatchObject({licenseRepairs:0,remainingMismatches:0});
      expect((await fixture.query('SELECT expires_at::text FROM licenses WHERE id=$1',[licenseId])).rows[0].expires_at).toBe(before);
    } finally {await fixture.query('SET session_replication_role = origin');fixture.release();}
  });

  it.each([false, true])('preserves submitted ISSUE evidence when an older snapshot has no key or expiry fields (pointer drift: %s)', async (pointerDrift) => {
    // Reproduce the existing demo fixture shape without weakening runtime guards.
    const fixture = await pool.connect();
    try {
      await fixture.query('SET session_replication_role = replica');
      await fixture.query(
        `UPDATE chain_commands SET payload=jsonb_build_object('seedNamespace','legacy-demo','licenseId',license_id),
           status='DEAD_LETTER', confirmed_at=NULL, confirmation_chain_event_id=NULL WHERE id=$1`,
        [issueCommand],
      );
      await fixture.query("UPDATE chain_events SET finality_status='PENDING', finalized_at=NULL WHERE chain_command_id=$1", [issueCommand]);
      await fixture.query(
        `UPDATE licenses SET status='PENDING_ONCHAIN', last_applied_chain_event_id=NULL,
           activation_key_trust_status='PENDING_FINALITY' WHERE id=$1`,
        [licenseId],
      );
      if (pointerDrift) await fixture.query(
        'UPDATE licenses SET last_applied_chain_event_id=(SELECT id FROM chain_events WHERE chain_command_id=$2) WHERE id=$1',
        [licenseId, issueCommand],
      );
    } finally {
      await fixture.query('SET session_replication_role = origin');
      fixture.release();
    }
    const snapshot = async () => (await pool.query(
      `SELECT l.status, l.expires_at, l.activation_commitment, l.activation_key_version,
         l.activation_key_trust_status, c.payload, c.payload_hash, c.nonce,
         c.signed_transaction, c.transaction_hash FROM licenses l
       JOIN chain_commands c ON c.license_id=l.id WHERE c.id=$1`, [issueCommand],
    )).rows[0];
    const before = await snapshot();
    await expect(eventRepository.reconcileCanonicalProjections()).resolves.toMatchObject({
      licenseRepairs: pointerDrift ? 1 : 0, commandRepairs: 0, remainingMismatches: 0,
    });
    await expect(snapshot()).resolves.toEqual(before);
    await expect(eventRepository.reconcileCanonicalProjections()).resolves.toMatchObject({ licenseRepairs: 0 });
    await expect(pool.query("UPDATE licenses SET activation_commitment=decode(repeat('12',32),'hex') WHERE id=$1", [licenseId]))
      .rejects.toThrow('ISSUE activation proposal is immutable after submission evidence exists');
  });

  it.each(['ACTIVE', 'EXPIRED'])('uses confirmed typed key evidence for a %s license with an incomplete JSON snapshot', async (status) => {
    const fixture = await pool.connect();
    const key = (await fixture.query('SELECT activation_commitment FROM licenses WHERE id=$1', [licenseId])).rows[0].activation_commitment;
    try {
      await fixture.query('SET session_replication_role = replica');
      await fixture.query("UPDATE chain_commands SET payload=payload - 'activationCommitment' - 'keyVersion' - 'expiresAt' WHERE id=$1", [issueCommand]);
      await fixture.query("UPDATE chain_events SET payload=payload - 'activationCommitment' - 'keyVersion' - 'expiresAt' WHERE chain_command_id=$1", [issueCommand]);
      if (status === 'EXPIRED') await fixture.query("UPDATE licenses SET status='EXPIRED', period_start=now() - interval '2 days', expires_at=now() - interval '1 day' WHERE id=$1", [licenseId]);
      await fixture.query('SET session_replication_role = origin');
      await expect(eventRepository.reconcileCanonicalProjections()).resolves.toMatchObject({ licenseRepairs: 0, remainingMismatches: 0 });
      // Known canonical key drift must still fail closed, not be hidden by the fallback.
      await fixture.query('SET session_replication_role = replica');
      await fixture.query("UPDATE licenses SET activation_commitment=decode(repeat('12',32),'hex') WHERE id=$1", [licenseId]);
      await fixture.query('SET session_replication_role = origin');
      await expect(eventRepository.reconcileCanonicalProjections()).rejects.toMatchObject({ code: 'P0001' });
    } finally {
      await fixture.query('SET session_replication_role = replica');
      await fixture.query('UPDATE licenses SET activation_commitment=$2 WHERE id=$1', [licenseId, key]);
      await fixture.query('SET session_replication_role = origin');
      fixture.release();
    }
  });

  it('invalidates and rebuilds reorged repository projections deterministically', async () => {
    const event = (await pool.query('SELECT id FROM chain_events WHERE chain_command_id=$1', [issueCommand])).rows[0];
    await eventRepository.markReorged(event.id);
    await eventRepository.markReorged(event.id);
    expect((await pool.query('SELECT status, activation_key_trust_status FROM licenses WHERE id=$1', [licenseId])).rows[0])
      .toEqual({ status: 'PENDING_ONCHAIN', activation_key_trust_status: 'UNTRUSTED_REORG' });
    expect((await pool.query('SELECT status FROM chain_commands WHERE id=$1', [issueCommand])).rows[0].status).toBe('SUBMITTED_UNKNOWN');
    expect((await pool.query('SELECT reorg_count FROM chain_events WHERE id=$1', [event.id])).rows[0].reorg_count).toBe(1);
    await ingestEvent(issueCommand, 'LICENSE_ISSUED');
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ status: 'ACTIVE' });
    const recovered = (await pool.query('SELECT reorg_count, reorged_at, finality_status FROM chain_events WHERE id=$1', [event.id])).rows[0];
    expect(recovered).toMatchObject({ reorg_count: 1, finality_status: 'CONFIRMED' });
    expect(recovered.reorged_at).toBeInstanceOf(Date);
  });
});
