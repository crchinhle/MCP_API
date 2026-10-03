export interface ReadinessProbe {
  readonly name: string;
  check(): Promise<void>;
}

export interface ReadinessResult {
  status: 'ok' | 'degraded';
  dependencies: Record<string, 'up' | 'down'>;
}

export class PlatformReadinessService {
  constructor(private readonly probes: readonly ReadinessProbe[]) {}

  async check(): Promise<ReadinessResult> {
    const results = await Promise.all(
      this.probes.map(async (probe) => {
        try {
          await probe.check();
          return [probe.name, 'up'] as const;
        } catch {
          return [probe.name, 'down'] as const;
        }
      }),
    );
    const dependencies = Object.fromEntries(results);
    const status = results.every(([, result]) => result === 'up')
      ? 'ok'
      : 'degraded';

    return { status, dependencies };
  }
}
