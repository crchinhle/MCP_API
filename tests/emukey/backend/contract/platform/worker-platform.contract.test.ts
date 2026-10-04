describe('worker platform contract', () => {
  const validEnvironment = {
    NODE_ENV: 'test',
    PORT: '3100',
    DATABASE_URL: 'postgresql://emukey:password@127.0.0.1:1/emukey',
    REDIS_URL: 'redis://127.0.0.1:1',
    CORS_ORIGINS: 'http://localhost:5173',
    LOG_LEVEL: 'fatal',
    OTEL_ENABLED: 'false',
    PAYMENT_ADAPTER: 'fake',
    SEPAY_SANDBOX_RECEIPT_TIMING: 'false',
    PAYMENT_WEBHOOK_SECRET: 'test-payment-secret',
    AI_ADAPTER: 'fake',
    EMAIL_ADAPTER: 'fake',
    PUSH_ADAPTER: 'fake',
    EVM_ADAPTER: 'viem',
    EVM_NETWORK: 'sepolia',
    EVM_CHAIN_ID: '11155111',
    EVM_CONFIRMATIONS: '2',
    EVM_CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    EVM_DEPLOYMENT_BLOCK: '1',
    EVM_INDEXER_BATCH_SIZE: '500',
    EVM_RPC_HTTP_URL: 'http://127.0.0.1:1',
    EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
    STORAGE_ADAPTER: 'local',
    ACTIVATION_ENVELOPE_ADAPTER: 'redis',
    ACTIVATION_ENVELOPE_KEY: '00'.repeat(32),
  };

  it('boots and closes an application context with validated config', async () => {
    Object.assign(process.env, validEnvironment);
    const { createWorkerContext } =
      await import('../../../../../EmuKey/backend/src/entrypoints/worker/create-worker-context.js');

    const context = await createWorkerContext({ logger: false });

    await expect(context.close()).resolves.toBeUndefined();
  }, 30_000);
});
