import { expect, it, vi } from 'vitest';
import { ActivationEnvelopeRecoveryService } from '../../../../EmuKey/backend/src/modules/blockchain/application/activation-envelope-recovery.service.js';

it('keeps the persisted provider key unchanged when Redis disappears', async () => {
  const envelopes = { read:vi.fn().mockRejectedValue(new Error('Redis offline')) };
  const handoff = { hasDurableCommandKey:vi.fn().mockResolvedValue(true) };
  const recovery = new ActivationEnvelopeRecoveryService({} as never,envelopes as never,handoff as never);
  const command = {commandId:'command',licenseId:'license',commandType:'ISSUE_LICENSE',payload:{keyVersion:1}};
  await expect(recovery.ensure(command as never)).resolves.toBe(command);
  expect(envelopes.read).not.toHaveBeenCalled();
});
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

it('keeps the durable encryption key when rotating development session secrets', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'emukey-dev-secret-rotation-'));
  try {
    await mkdir(join(temporary, 'scripts'));
    const script = join(temporary, 'scripts', 'rotate-dev-secrets.mjs');
    await copyFile(resolve('scripts/rotate-dev-secrets.mjs'), script);
    const storageKey = 'ab'.repeat(32);
    await writeFile(join(temporary, '.env'), `JWT_SECRET=old-jwt\nSESSION_SECRET=old-session\nACTIVATION_ENVELOPE_KEY=${storageKey}\n`);
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const output = await readFile(join(temporary, '.env'), 'utf8');
    expect(output).toContain(`ACTIVATION_ENVELOPE_KEY=${storageKey}`);
    expect(output).not.toMatch(/old-jwt|old-session/);
    expect(result.stdout).not.toContain(storageKey);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
