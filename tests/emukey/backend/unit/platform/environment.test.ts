import { validateEnvironment } from '../../../../../EmuKey/backend/src/platform/config/environment.js';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3100',
  DATABASE_URL: 'postgresql://emukey:password@localhost:5432/emukey',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:8081',
  LOG_LEVEL: 'info',
  OTEL_ENABLED: 'false',
  PAYMENT_ADAPTER: 'fake',
  PAYMENT_WEBHOOK_SECRET: 'test-payment-secret',
  AI_ADAPTER: 'fake',
  EMAIL_ADAPTER: 'fake',
  PUSH_ADAPTER: 'fake',
  EVM_ADAPTER: 'viem',
  EVM_NETWORK: 'hardhat',
  EVM_CHAIN_ID: '31337',
  EVM_CONFIRMATIONS: '2',
  EVM_CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  EVM_DEPLOYMENT_BLOCK: '1',
  EVM_INDEXER_BATCH_SIZE: '500',
  EVM_RPC_HTTP_URL: 'http://localhost:8545',
  EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
  STORAGE_ADAPTER: 'local',
  ACTIVATION_ENVELOPE_ADAPTER: 'redis',
  ACTIVATION_ENVELOPE_KEY: '00'.repeat(32),
  JWT_SECRET: 'test-jwt-secret-32-characters-minimum',
};

describe('validateEnvironment', () => {
  it('rejects receipt timing outside SePay sandbox and rejects mixing clock policies', () => {
    const sepay = { ...validEnvironment, PAYMENT_ADAPTER: 'sepay', SEPAY_ENV: 'sandbox', SEPAY_MERCHANT_ID: 'test', SEPAY_SECRET_KEY: 'secret', WEB_APP_URL: 'https://demo.test', SEPAY_SANDBOX_RECEIPT_TIMING: 'true' };
    expect(validateEnvironment(sepay).SEPAY_SANDBOX_RECEIPT_TIMING).toBe(true);
    expect(() => validateEnvironment({ ...sepay, SEPAY_ENV: 'production' })).toThrow('SEPAY_SANDBOX_RECEIPT_TIMING requires non-production SePay sandbox');
    expect(() => validateEnvironment({ ...sepay, NODE_ENV: 'production' })).toThrow('SEPAY_SANDBOX_RECEIPT_TIMING requires non-production SePay sandbox');
    expect(() => validateEnvironment({ ...sepay, SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS: '144' })).toThrow('Sandbox receipt timing cannot be combined with a clock offset');
  });
  it('normalizes a complete local configuration', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3100);
    expect(result.OTEL_ENABLED).toBe(false);
    expect(result.IPN_DELIVERY_GRACE_SECONDS).toBe(86_400);
    expect(result.EVM_CONTRACT_ADDRESS).toBe(
      '0x5fbdb2315678afecb367f032d93f642f64180aa3',
    );
    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:5173',
      'http://localhost:8081',
    ]);
  });

  it('validates the payment IPN delivery grace policy', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        IPN_DELIVERY_GRACE_SECONDS: '7200',
      }).IPN_DELIVERY_GRACE_SECONDS,
    ).toBe(7200);
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        IPN_DELIVERY_GRACE_SECONDS: '0',
      }),
    ).toThrow('IPN_DELIVERY_GRACE_SECONDS must be a positive safe integer');
  });

  it('fails fast when a durable dependency URL is missing', () => {
    const missingDatabase = { ...validEnvironment, DATABASE_URL: undefined };

    expect(() => validateEnvironment(missingDatabase)).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('allows fake adapters only in the explicit test environment', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'development' }),
    ).toThrow('PAYMENT_ADAPTER fake adapter is test-only');
  });

  it('requires an OTLP endpoint when tracing is enabled', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, OTEL_ENABLED: 'true' }),
    ).toThrow('OTEL_EXPORTER_OTLP_ENDPOINT is required');
  });

  it('requires Brevo credentials only when the Brevo email adapter is selected', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        EMAIL_ADAPTER: 'brevo',
      }),
    ).toThrow('BREVO_API_KEY is required');

    const result = validateEnvironment({
      ...validEnvironment,
      BREVO_API_KEY: 'test-brevo-api-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.com',
      BREVO_SENDER_NAME: 'Emukey',
      EMAIL_ADAPTER: 'brevo',
      WEB_APP_URL: 'http://localhost:5173',
    });

    expect(result).toMatchObject({
      BREVO_API_KEY: 'test-brevo-api-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.com',
      BREVO_SENDER_NAME: 'Emukey',
      EMAIL_ADAPTER: 'brevo',
      WEB_APP_URL: 'http://localhost:5173',
    });
  });

  it('requires SePay credentials only when the SePay adapter is selected', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PAYMENT_ADAPTER: 'sepay',
      }),
    ).toThrow('SEPAY_ENV is required');

    const result = validateEnvironment({
      ...validEnvironment,
      PAYMENT_ADAPTER: 'sepay',
      SEPAY_ENV: 'sandbox',
      SEPAY_MERCHANT_ID: 'SP-TEST-EMUKEY',
      SEPAY_SECRET_KEY: 'sandbox-merchant-secret',
      WEB_APP_URL: 'https://demo.emukey.test',
    });

    expect(result).toMatchObject({
      PAYMENT_ADAPTER: 'sepay',
      SEPAY_ENV: 'sandbox',
      SEPAY_MERCHANT_ID: 'SP-TEST-EMUKEY',
      SEPAY_SECRET_KEY: 'sandbox-merchant-secret',
      WEB_APP_URL: 'https://demo.emukey.test',
    });
  });

  it('requires an injected relayer private key for the viem adapter', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        EVM_RELAYER_PRIVATE_KEY: undefined,
        NODE_ENV: 'test',
      }),
    ).toThrow('EVM_RELAYER_PRIVATE_KEY is required');

    const result = validateEnvironment({
      ...validEnvironment,
      EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
      NODE_ENV: 'test',
    });
    expect(result.EVM_RELAYER_PRIVATE_KEY).toBe(`0x${'11'.repeat(32)}`);
    expect(result.EVM_RPC_HTTP_URL).toBe('http://localhost:8545');
  });

  it('rejects malformed relayer private keys', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        EVM_RELAYER_PRIVATE_KEY: 'not-a-key',
      }),
    ).toThrow('EVM_RELAYER_PRIVATE_KEY must contain a 32-byte hex key');
  });

  it('rejects the public Hardhat relayer key in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        PAYMENT_ADAPTER: 'sepay',
        SEPAY_ENV: 'production',
        SEPAY_MERCHANT_ID: 'SP-LIVE-EMUKEY',
        SEPAY_SECRET_KEY: 'production-merchant-secret',
         AI_ADAPTER: 'gemini',
         GEMINI_API_KEY: 'test-gemini-key',
         GEMINI_MODEL: 'gemini-2.0-flash',
        EMAIL_ADAPTER: 'brevo',
        BREVO_API_KEY: 'test-brevo-api-key',
        BREVO_SENDER_EMAIL: 'no-reply@example.com',
        BREVO_SENDER_NAME: 'Emukey',
        WEB_APP_URL: 'https://app.example.com',
         PUSH_ADAPTER: 'fcm',
         FCM_PROJECT_ID: 'emukey-test',
         FCM_CLIENT_EMAIL: 'fcm@example.com',
         FCM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
         CLOUDINARY_CLOUD_NAME: 'test-cloud',
         CLOUDINARY_API_KEY: 'test-key',
         CLOUDINARY_API_SECRET: 'test-secret',
        STORAGE_ADAPTER: 'cloudinary',
        EVM_RPC_HTTP_URL: 'https://rpc.example.com',
        EVM_RELAYER_PRIVATE_KEY:
          '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      }),
    ).toThrow(
      'EVM_RELAYER_PRIVATE_KEY cannot use the public Hardhat development key in production',
    );
  });

  it('rejects local storage in production', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      PAYMENT_ADAPTER: 'sepay',
      SEPAY_ENV: 'production',
      SEPAY_MERCHANT_ID: 'SP-LIVE-EMUKEY',
      SEPAY_SECRET_KEY: 'production-merchant-secret',
      AI_ADAPTER: 'gemini',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-2.0-flash',
      EMAIL_ADAPTER: 'brevo',
      BREVO_API_KEY: 'test-brevo-api-key',
      BREVO_SENDER_EMAIL: 'no-reply@example.com',
      BREVO_SENDER_NAME: 'Emukey',
      WEB_APP_URL: 'https://app.example.com',
      PUSH_ADAPTER: 'fcm',
      FCM_PROJECT_ID: 'emukey-test',
      FCM_CLIENT_EMAIL: 'fcm@example.com',
      FCM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      STORAGE_ADAPTER: 'local',
    })).toThrow('STORAGE_ADAPTER cannot use local in production');
  });
});
