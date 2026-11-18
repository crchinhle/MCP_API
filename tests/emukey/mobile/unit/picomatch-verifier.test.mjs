import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../../EmuKey/mobile/', import.meta.url));
const verifier = join(root, 'scripts/verify-patches.mjs');

test('bootstrap verifies the actual installation before toolchain execution', () => {
  const result = spawnSync(process.execPath, [verifier], { encoding: 'utf8', timeout: 60_000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'VERIFIED_LOCAL_MITIGATION');
  assert.ok(report.copies.length >= 2);
  assert.ok(report.callers.some(caller => caller.name === 'micromatch'));
  assert.ok(report.callers.some(caller => caller.name === 'jest-util'));
});

test('traversal rejects hidden stale copies, unexpected versions and escaped symlinks', async () => {
  const { inspectModules } = await import(pathToFileURL(verifier));
  const directory = mkdtempSync(join(tmpdir(), 'emukey-picomatch-test-'));
  try {
    const modules = join(directory, 'node_modules');
    const stale = join(modules, '.pnpm/stale/node_modules/picomatch');
    mkdirSync(join(stale, 'lib'), { recursive: true });
    writeFileSync(join(stale, 'package.json'), JSON.stringify({ name: 'picomatch', version: '2.3.2' }));
    writeFileSync(join(stale, 'lib/parse.js'), 'unpatched');
    assert.throws(() => inspectModules(modules), /unapproved parser hash/);
    writeFileSync(join(stale, 'package.json'), JSON.stringify({ name: 'picomatch', version: '99.0.0' }));
    assert.throws(() => inspectModules(modules), /unapproved picomatch version/);
    rmSync(join(modules, '.pnpm'), { recursive: true });
    const outside = join(directory, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(modules, 'escaped'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => inspectModules(modules), /module escapes installation/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('bounded child execution treats timeouts and unsuccessful results as failure', async () => {
  const { runNodeProbe } = await import(pathToFileURL(verifier));
  assert.throws(() => runNodeProbe('while (true) {}', [], 100), /probe failed/);
  assert.throws(() => runNodeProbe('process.exit(0)', []), /probe result/);
  assert.throws(() => runNodeProbe('throw Error("failure")', []), /probe failed/);
});
