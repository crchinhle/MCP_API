/** Outbound HTTPS boundary; no HTTP client or DNS types escape this contract. */
export interface ProviderLicenseGatewayPort {
  validateEndpoint(endpoint: string): void;
  send(
    endpoint: string,
    token: string,
    body: unknown,
    deliveryId: string,
  ): Promise<unknown>;
}

export class ProviderTransportError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
    readonly retryAfterMs?: number,
  ) {
    super(code);
  }
}
