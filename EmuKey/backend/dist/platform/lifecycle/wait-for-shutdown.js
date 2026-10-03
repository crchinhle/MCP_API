export function waitForShutdown(signals = process) {
    return new Promise((resolve) => {
        const keepAlive = setInterval(() => undefined, 60_000);
        const shutdown = () => {
            clearInterval(keepAlive);
            signals.removeListener('SIGINT', shutdown);
            signals.removeListener('SIGTERM', shutdown);
            resolve();
        };
        signals.once('SIGINT', shutdown);
        signals.once('SIGTERM', shutdown);
    });
}
//# sourceMappingURL=wait-for-shutdown.js.map