interface TelemetrySdk {
    shutdown(): Promise<void>;
    start(): void;
}
type TelemetrySdkFactory = () => TelemetrySdk;
export interface TelemetryHandle {
    shutdown(): Promise<void>;
}
export declare function startTelemetry(environment: Record<string, string | undefined>, factory?: TelemetrySdkFactory): Promise<TelemetryHandle>;
export {};
