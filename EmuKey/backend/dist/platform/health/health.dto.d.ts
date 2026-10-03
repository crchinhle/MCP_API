export declare class LivenessDto {
    status: 'ok';
    service: 'emukey-api';
}
export declare class ReadinessDto {
    status: 'ok' | 'degraded';
    dependencies: Record<string, 'up' | 'down'>;
}
