export class PlatformReadinessService {
    probes;
    constructor(probes) {
        this.probes = probes;
    }
    async check() {
        const results = await Promise.all(this.probes.map(async (probe) => {
            try {
                await probe.check();
                return [probe.name, 'up'];
            }
            catch {
                return [probe.name, 'down'];
            }
        }));
        const dependencies = Object.fromEntries(results);
        const status = results.every(([, result]) => result === 'up')
            ? 'ok'
            : 'degraded';
        return { status, dependencies };
    }
}
//# sourceMappingURL=platform-readiness.service.js.map