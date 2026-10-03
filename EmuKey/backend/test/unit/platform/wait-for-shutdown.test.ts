import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { waitForShutdown } from '../../../src/platform/lifecycle/wait-for-shutdown.js';

describe('waitForShutdown', () => {
  it('keeps the worker pending until a shutdown signal arrives', async () => {
    const signals = new EventEmitter();
    let resolved = false;
    const waiting = waitForShutdown(signals).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    signals.emit('SIGTERM');
    await waiting;
    expect(resolved).toBe(true);
  });
});
