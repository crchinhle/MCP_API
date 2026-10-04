const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;
const AI_ADAPTERS = ['fake', 'gemini'] as const;
const EMAIL_ADAPTERS = ['fake', 'brevo'] as const;
const PUSH_ADAPTERS = ['fake', 'fcm'] as const;
const STORAGE_ADAPTERS = ['local', 'cloudinary'] as const;
const PAYMENT_ADAPTERS = ['fake', 'sepay'] as const;
const SEPAY_ENVIRONMENTS = ['sandbox', 'production'] as const;
const LOCAL_ADAPTERS = [
  'PAYMENT_ADAPTER',
  'AI_ADAPTER',
  'EMAIL_ADAPTER',
  'PUSH_ADAPTER',
  'STORAGE_ADAPTER',
] as const;

const HARDHAT_DEVELOPMENT_RELAYER_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
type LogLevel = (typeof LOG_LEVELS)[number];
type EmailAdapter = (typeof EMAIL_ADAPTERS)[number];
type AiAdapter = (typeof AI_ADAPTERS)[number];
type PushAdapter = (typeof PUSH_ADAPTERS)[number];
type StorageAdapter = (typeof STORAGE_ADAPTERS)[number];
type PaymentAdapter = (typeof PAYMENT_ADAPTERS)[number];
type SePayEnvironment = (typeof SEPAY_ENVIRONMENTS)[number];

export interface PlatformEnvironment {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  CORS_ORIGINS: string[];
  LOG_LEVEL: LogLevel;
  OTEL_ENABLED: boolean;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  PAYMENT_ADAPTER: PaymentAdapter;
  IPN_DELIVERY_GRACE_SECONDS: number;
  PAYMENT_WEBHOOK_SECRET?: string;
  SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS: number;
  SEPAY_SANDBOX_RECEIPT_TIMING: boolean;
  SEPAY_ENV?: SePayEnvironment;
  SEPAY_MERCHANT_ID?: string;
  SEPAY_SECRET_KEY?: string;
  AI_ADAPTER: AiAdapter;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_TIMEOUT_MS: number;
  GEMINI_MAX_OUTPUT_TOKENS: number;
  EMAIL_ADAPTER: EmailAdapter;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  WEB_APP_URL?: string;
  PUSH_ADAPTER: PushAdapter;
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  FCM_TIMEOUT_MS: number;
  EVM_ADAPTER: string;
  EVM_NETWORK: string;
  EVM_CHAIN_ID: number;
  EVM_CONFIRMATIONS: number;
  EVM_CONTRACT_ADDRESS: string;
  EVM_DEPLOYMENT_BLOCK?: number;
  EVM_INDEXER_BATCH_SIZE?: number;
  EVM_RPC_HTTP_URL?: string;
  EVM_RPC_FALLBACK_HTTP_URL?: string;
  EVM_RELAYER_PRIVATE_KEY?: string;
  STORAGE_ADAPTER: StorageAdapter;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_FOLDER?: string;
  KNOWLEDGE_MAX_FILE_BYTES: number;
  KNOWLEDGE_MAX_CHUNKS: number;
  KNOWLEDGE_MAX_CHUNK_BYTES: number;
  KNOWLEDGE_CHUNK_OVERLAP: number;
  KNOWLEDGE_ALLOWED_MIME_TYPES: string[];
  NOTIFICATION_MAX_ATTEMPTS: number;
  NOTIFICATION_LEASE_SECONDS: number;
  NOTIFICATION_RETRY_BASE_SECONDS: number;
  PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE: number;
  PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE: number;
  PUBLIC_VERIFY_ID_MIN_LENGTH: number;
  ACTIVATION_ENVELOPE_ADAPTER: string;
  ACTIVATION_ENVELOPE_KEY: string;
  JWT_SECRET: string;
}

function requiredString(
  environment: Record<string, unknown>,
  name: string,
): string {
  const value = environment[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function oneOf<const T extends readonly string[]>(
  value: string,
  name: string,
  options: T,
): T[number] {
  if (!options.includes(value)) {
    throw new Error(`${name} must be one of: ${options.join(', ')}`);
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return parsed;
}

function parseBoolean(value: string, name: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function parseOrigins(value: string): string[] {
  const origins = [...new Set(value.split(',').map((origin) => origin.trim()))];
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
  }
  return origins;
}

function assertHttpUrl(value: string, name: string): void {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must use http or https`);
  }
}

function assertSepoliaRuntime(network: string, chainId: number): void {
  if (network !== 'sepolia' || chainId !== 11_155_111) {
    throw new Error('EVM_RUNTIME_MUST_BE_SEPOLIA');
  }
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): PlatformEnvironment {
  const nodeEnvironment = oneOf(
    requiredString(environment, 'NODE_ENV'),
    'NODE_ENV',
    NODE_ENVIRONMENTS,
  );
  const otelEnabled = parseBoolean(
    requiredString(environment, 'OTEL_ENABLED'),
    'OTEL_ENABLED',
  );
  const otlpEndpoint =
    typeof environment.OTEL_EXPORTER_OTLP_ENDPOINT === 'string' &&
    environment.OTEL_EXPORTER_OTLP_ENDPOINT.trim() !== ''
      ? environment.OTEL_EXPORTER_OTLP_ENDPOINT.trim()
      : undefined;

  if (otelEnabled && otlpEndpoint === undefined) {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT is required');
  }
  if (otlpEndpoint !== undefined) {
    assertHttpUrl(otlpEndpoint, 'OTEL_EXPORTER_OTLP_ENDPOINT');
  }

  const result: PlatformEnvironment = {
    NODE_ENV: nodeEnvironment,
    PORT: parsePort(requiredString(environment, 'PORT')),
    DATABASE_URL: requiredString(environment, 'DATABASE_URL'),
    REDIS_URL: requiredString(environment, 'REDIS_URL'),
    CORS_ORIGINS: parseOrigins(requiredString(environment, 'CORS_ORIGINS')),
    LOG_LEVEL: oneOf(
      requiredString(environment, 'LOG_LEVEL'),
      'LOG_LEVEL',
      LOG_LEVELS,
    ),
    OTEL_ENABLED: otelEnabled,
    PAYMENT_ADAPTER: oneOf(
      requiredString(environment, 'PAYMENT_ADAPTER'),
      'PAYMENT_ADAPTER',
      PAYMENT_ADAPTERS,
    ),
    SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS: parseNonNegativeInteger(
      typeof environment.SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS === 'string' ? environment.SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS : '0',
      'SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS',
    ),
    SEPAY_SANDBOX_RECEIPT_TIMING: oneOf(
      typeof environment.SEPAY_SANDBOX_RECEIPT_TIMING === 'string' ? environment.SEPAY_SANDBOX_RECEIPT_TIMING : 'false',
      'SEPAY_SANDBOX_RECEIPT_TIMING', ['true', 'false'] as const,
    ) === 'true',
    IPN_DELIVERY_GRACE_SECONDS: parsePositiveInteger(
      typeof environment.IPN_DELIVERY_GRACE_SECONDS === 'string' &&
        environment.IPN_DELIVERY_GRACE_SECONDS.trim() !== ''
        ? environment.IPN_DELIVERY_GRACE_SECONDS
        : '86400',
      'IPN_DELIVERY_GRACE_SECONDS',
    ),
    AI_ADAPTER: oneOf(requiredString(environment, 'AI_ADAPTER'), 'AI_ADAPTER', AI_ADAPTERS),
    EMAIL_ADAPTER: oneOf(
      requiredString(environment, 'EMAIL_ADAPTER'),
      'EMAIL_ADAPTER',
      EMAIL_ADAPTERS,
    ),
    PUSH_ADAPTER: oneOf(requiredString(environment, 'PUSH_ADAPTER'), 'PUSH_ADAPTER', PUSH_ADAPTERS),
    EVM_ADAPTER: requiredString(environment, 'EVM_ADAPTER'),
    EVM_NETWORK: requiredString(environment, 'EVM_NETWORK'),
    EVM_CHAIN_ID: parsePositiveInteger(
      requiredString(environment, 'EVM_CHAIN_ID'),
      'EVM_CHAIN_ID',
    ),
    EVM_CONFIRMATIONS: parsePositiveInteger(
      requiredString(environment, 'EVM_CONFIRMATIONS'),
      'EVM_CONFIRMATIONS',
    ),
    EVM_CONTRACT_ADDRESS: requiredString(environment, 'EVM_CONTRACT_ADDRESS'),
    STORAGE_ADAPTER: oneOf(requiredString(environment, 'STORAGE_ADAPTER'), 'STORAGE_ADAPTER', STORAGE_ADAPTERS),
    ACTIVATION_ENVELOPE_ADAPTER: requiredString(
      environment,
      'ACTIVATION_ENVELOPE_ADAPTER',
    ),
    ACTIVATION_ENVELOPE_KEY: requiredString(
      environment,
      'ACTIVATION_ENVELOPE_KEY',
    ),
    JWT_SECRET: requiredString(environment, 'JWT_SECRET'),
    GEMINI_TIMEOUT_MS: parsePositiveInteger(typeof environment.GEMINI_TIMEOUT_MS === 'string' && environment.GEMINI_TIMEOUT_MS.trim() !== '' ? environment.GEMINI_TIMEOUT_MS : '15000', 'GEMINI_TIMEOUT_MS'),
    GEMINI_MAX_OUTPUT_TOKENS: parsePositiveInteger(typeof environment.GEMINI_MAX_OUTPUT_TOKENS === 'string' && environment.GEMINI_MAX_OUTPUT_TOKENS.trim() !== '' ? environment.GEMINI_MAX_OUTPUT_TOKENS : '1024', 'GEMINI_MAX_OUTPUT_TOKENS'),
    FCM_TIMEOUT_MS: parsePositiveInteger(typeof environment.FCM_TIMEOUT_MS === 'string' && environment.FCM_TIMEOUT_MS.trim() !== '' ? environment.FCM_TIMEOUT_MS : '10000', 'FCM_TIMEOUT_MS'),
    KNOWLEDGE_MAX_FILE_BYTES: parsePositiveInteger(typeof environment.KNOWLEDGE_MAX_FILE_BYTES === 'string' && environment.KNOWLEDGE_MAX_FILE_BYTES.trim() !== '' ? environment.KNOWLEDGE_MAX_FILE_BYTES : '10485760', 'KNOWLEDGE_MAX_FILE_BYTES'),
    KNOWLEDGE_MAX_CHUNKS: parsePositiveInteger(typeof environment.KNOWLEDGE_MAX_CHUNKS === 'string' && environment.KNOWLEDGE_MAX_CHUNKS.trim() !== '' ? environment.KNOWLEDGE_MAX_CHUNKS : '500', 'KNOWLEDGE_MAX_CHUNKS'),
    KNOWLEDGE_MAX_CHUNK_BYTES: parsePositiveInteger(typeof environment.KNOWLEDGE_MAX_CHUNK_BYTES === 'string' && environment.KNOWLEDGE_MAX_CHUNK_BYTES.trim() !== '' ? environment.KNOWLEDGE_MAX_CHUNK_BYTES : '12000', 'KNOWLEDGE_MAX_CHUNK_BYTES'),
    KNOWLEDGE_CHUNK_OVERLAP: parseNonNegativeInteger(typeof environment.KNOWLEDGE_CHUNK_OVERLAP === 'string' && environment.KNOWLEDGE_CHUNK_OVERLAP.trim() !== '' ? environment.KNOWLEDGE_CHUNK_OVERLAP : '200', 'KNOWLEDGE_CHUNK_OVERLAP'),
    KNOWLEDGE_ALLOWED_MIME_TYPES: (typeof environment.KNOWLEDGE_ALLOWED_MIME_TYPES === 'string' && environment.KNOWLEDGE_ALLOWED_MIME_TYPES.trim() !== '' ? environment.KNOWLEDGE_ALLOWED_MIME_TYPES : 'application/pdf,text/plain').split(',').map((value) => value.trim()).filter(Boolean),
    NOTIFICATION_MAX_ATTEMPTS: parsePositiveInteger(typeof environment.NOTIFICATION_MAX_ATTEMPTS === 'string' && environment.NOTIFICATION_MAX_ATTEMPTS.trim() !== '' ? environment.NOTIFICATION_MAX_ATTEMPTS : '5', 'NOTIFICATION_MAX_ATTEMPTS'),
    NOTIFICATION_LEASE_SECONDS: parsePositiveInteger(typeof environment.NOTIFICATION_LEASE_SECONDS === 'string' && environment.NOTIFICATION_LEASE_SECONDS.trim() !== '' ? environment.NOTIFICATION_LEASE_SECONDS : '300', 'NOTIFICATION_LEASE_SECONDS'),
    NOTIFICATION_RETRY_BASE_SECONDS: parsePositiveInteger(typeof environment.NOTIFICATION_RETRY_BASE_SECONDS === 'string' && environment.NOTIFICATION_RETRY_BASE_SECONDS.trim() !== '' ? environment.NOTIFICATION_RETRY_BASE_SECONDS : '30', 'NOTIFICATION_RETRY_BASE_SECONDS'),
    PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE: parsePositiveInteger(typeof environment.PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE === 'string' && environment.PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE.trim() !== '' ? environment.PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE : '30', 'PUBLIC_VERIFY_RATE_LIMIT_PER_MINUTE'),
    PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE: parsePositiveInteger(typeof environment.PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE === 'string' && environment.PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE.trim() !== '' ? environment.PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE : '30', 'PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE'),
    PUBLIC_VERIFY_ID_MIN_LENGTH: parsePositiveInteger(typeof environment.PUBLIC_VERIFY_ID_MIN_LENGTH === 'string' && environment.PUBLIC_VERIFY_ID_MIN_LENGTH.trim() !== '' ? environment.PUBLIC_VERIFY_ID_MIN_LENGTH : '20', 'PUBLIC_VERIFY_ID_MIN_LENGTH'),
  };

  if (otlpEndpoint !== undefined) {
    result.OTEL_EXPORTER_OTLP_ENDPOINT = otlpEndpoint;
  }
  if (result.EMAIL_ADAPTER === 'brevo') {
    result.BREVO_API_KEY = requiredString(environment, 'BREVO_API_KEY');
    result.BREVO_SENDER_EMAIL = requiredString(
      environment,
      'BREVO_SENDER_EMAIL',
    );
    result.BREVO_SENDER_NAME = requiredString(
      environment,
      'BREVO_SENDER_NAME',
    );
  }
  if (result.AI_ADAPTER === 'gemini') {
    result.GEMINI_API_KEY = requiredString(environment, 'GEMINI_API_KEY');
    result.GEMINI_MODEL = requiredString(environment, 'GEMINI_MODEL');
  }
  if (result.PUSH_ADAPTER === 'fcm') {
    result.FCM_PROJECT_ID = requiredString(environment, 'FCM_PROJECT_ID');
    result.FCM_CLIENT_EMAIL = requiredString(environment, 'FCM_CLIENT_EMAIL');
    const privateKey = requiredString(environment, 'FCM_PRIVATE_KEY').replaceAll('\\n', '\n');
    if (!privateKey.includes('BEGIN PRIVATE KEY')) throw new Error('FCM_PRIVATE_KEY must be a PEM private key');
    result.FCM_PRIVATE_KEY = privateKey;
  }
  if (result.STORAGE_ADAPTER === 'cloudinary') {
    result.CLOUDINARY_CLOUD_NAME = requiredString(environment, 'CLOUDINARY_CLOUD_NAME');
    result.CLOUDINARY_API_KEY = requiredString(environment, 'CLOUDINARY_API_KEY');
    result.CLOUDINARY_API_SECRET = requiredString(environment, 'CLOUDINARY_API_SECRET');
    result.CLOUDINARY_FOLDER = typeof environment.CLOUDINARY_FOLDER === 'string' && environment.CLOUDINARY_FOLDER.trim() !== '' ? environment.CLOUDINARY_FOLDER.trim() : 'emukey/knowledge';
  }
  if (result.PAYMENT_ADAPTER === 'sepay') {
    result.SEPAY_ENV = oneOf(
      requiredString(environment, 'SEPAY_ENV'),
      'SEPAY_ENV',
      SEPAY_ENVIRONMENTS,
    );
    result.SEPAY_MERCHANT_ID = requiredString(environment, 'SEPAY_MERCHANT_ID');
    result.SEPAY_SECRET_KEY = requiredString(environment, 'SEPAY_SECRET_KEY');
  } else {
    result.PAYMENT_WEBHOOK_SECRET = requiredString(
      environment,
      'PAYMENT_WEBHOOK_SECRET',
    );
  }
  if (result.EMAIL_ADAPTER === 'brevo' || result.PAYMENT_ADAPTER === 'sepay') {
    result.WEB_APP_URL = requiredString(environment, 'WEB_APP_URL');
    assertHttpUrl(result.WEB_APP_URL, 'WEB_APP_URL');
  }
  if (result.SEPAY_SANDBOX_RECEIPT_TIMING) {
    if (nodeEnvironment === 'production' || result.PAYMENT_ADAPTER !== 'sepay' || result.SEPAY_ENV !== 'sandbox') {
      throw new Error('SEPAY_SANDBOX_RECEIPT_TIMING requires non-production SePay sandbox');
    }
    if (result.SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS !== 0) {
      throw new Error('Sandbox receipt timing cannot be combined with a clock offset');
    }
  }
  if (result.EVM_ADAPTER !== 'viem') {
    throw new Error('EVM_ADAPTER must use viem');
  }
  result.EVM_RPC_HTTP_URL = requiredString(environment, 'EVM_RPC_HTTP_URL');
  assertHttpUrl(result.EVM_RPC_HTTP_URL, 'EVM_RPC_HTTP_URL');
  if (
    typeof environment.EVM_RPC_FALLBACK_HTTP_URL === 'string' &&
    environment.EVM_RPC_FALLBACK_HTTP_URL.trim() !== ''
  ) {
    result.EVM_RPC_FALLBACK_HTTP_URL = environment.EVM_RPC_FALLBACK_HTTP_URL.trim();
    assertHttpUrl(result.EVM_RPC_FALLBACK_HTTP_URL, 'EVM_RPC_FALLBACK_HTTP_URL');
  }
  result.EVM_DEPLOYMENT_BLOCK = parseNonNegativeInteger(
    requiredString(environment, 'EVM_DEPLOYMENT_BLOCK'),
    'EVM_DEPLOYMENT_BLOCK',
  );
  result.EVM_INDEXER_BATCH_SIZE = parsePositiveInteger(
    requiredString(environment, 'EVM_INDEXER_BATCH_SIZE'),
    'EVM_INDEXER_BATCH_SIZE',
  );
  result.EVM_RELAYER_PRIVATE_KEY = requiredString(
    environment,
    'EVM_RELAYER_PRIVATE_KEY',
  );
  if (!/^0x[0-9a-fA-F]{64}$/.test(result.EVM_RELAYER_PRIVATE_KEY)) {
    throw new Error('EVM_RELAYER_PRIVATE_KEY must contain a 32-byte hex key');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(result.EVM_CONTRACT_ADDRESS)) {
    throw new Error('EVM_CONTRACT_ADDRESS must contain a 20-byte address');
  }
  result.EVM_CONTRACT_ADDRESS = result.EVM_CONTRACT_ADDRESS.toLowerCase();
  assertSepoliaRuntime(result.EVM_NETWORK, result.EVM_CHAIN_ID);
  if (!/^[0-9a-fA-F]{64}$/.test(result.ACTIVATION_ENVELOPE_KEY)) {
    throw new Error('ACTIVATION_ENVELOPE_KEY must contain exactly 32 bytes');
  }
  if (nodeEnvironment === 'production') {
    if (result.SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS !== 0) {
      throw new Error('SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS must be 0 in production');
    }
    for (const adapterName of LOCAL_ADAPTERS) {
      if (result[adapterName] === 'fake') {
        throw new Error(`${adapterName} cannot use fake in production`);
      }
    }
    if (
      result.EVM_RELAYER_PRIVATE_KEY?.toLowerCase() ===
      HARDHAT_DEVELOPMENT_RELAYER_KEY
    ) {
      throw new Error(
        'EVM_RELAYER_PRIVATE_KEY cannot use the public Hardhat development key in production',
      );
    }
    if (result.STORAGE_ADAPTER === 'local') {
      throw new Error('STORAGE_ADAPTER cannot use local in production');
    }
    if (result.EVM_NETWORK !== 'sepolia') {
      throw new Error('EVM_NETWORK must use sepolia in production');
    }
    if (result.EVM_RPC_HTTP_URL.startsWith('http://')) {
      throw new Error('EVM_RPC_HTTP_URL must use HTTPS in production');
    }
    if (result.EVM_RPC_FALLBACK_HTTP_URL?.startsWith('http://')) {
      throw new Error('EVM_RPC_FALLBACK_HTTP_URL must use HTTPS in production');
    }
    if (result.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters in production');
    }
  }

  if (nodeEnvironment !== 'test') {
    for (const adapterName of LOCAL_ADAPTERS) {
      if (result[adapterName] === 'fake') {
        throw new Error(`${adapterName} fake adapter is test-only`);
      }
    }
  }

  return result;
}
