export interface ReadinessProbe {
    readonly name: string;
    check(): Promise<void>;
}
export interface ReadinessResult {
    status: 'ok' | 'degraded';
    dependencies: Record<string, 'up' | 'down'>;
}
export declare class PlatformReadinessService {
    private readonly probes;
    constructor(probes: readonly ReadinessProbe[]);
    check(): Promise<ReadinessResult>;
}
