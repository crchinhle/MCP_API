export interface ShutdownSignalSource {
    once(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
    removeListener(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}
export declare function waitForShutdown(signals?: ShutdownSignalSource): Promise<void>;
