export interface ShutdownSignalSource {
  once(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  removeListener(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

export function waitForShutdown(
  signals: ShutdownSignalSource = process,
): Promise<void> {
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
