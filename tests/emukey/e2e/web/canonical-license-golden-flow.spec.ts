import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const workspace = resolve(import.meta.dirname, '../../..');
const runnerPath = resolve(workspace, 'tooling/emukey/verification/run-web-e2e.mjs');
const canonicalSpecPath = resolve(workspace, 'tests/emukey/e2e/web/canonical-license-golden-flow.spec.ts');
const staleSpecPath = resolve(workspace, 'tests/emukey/e2e/web/user-license-run.spec.ts');
const phase6SpecPath = resolve(workspace, 'tests/emukey/e2e/web/phase6-license-flow.spec.ts');

function read(relativePath: string): string {
  return readFileSync(resolve(workspace, relativePath), 'utf8');
}

test.describe('canonical E2E secret handling', () => {
  test('the runner never requires or forwards an activation key', () => {
    const runner = read('tooling/emukey/verification/run-web-e2e.mjs');
    expect(runner).not.toContain('E2E_ACTIVATION_KEY');
    expect(runner).not.toContain('activationKey');
    expect(runner).toMatch(/E2E_RUN_ID/);
  });

  test('the canonical spec keeps the activation key in memory only', () => {
    const spec = read('tests/emukey/e2e/web/canonical-license-golden-flow.spec.ts');
    expect(spec).not.toContain('E2E_ACTIVATION_KEY');
    expect(spec).not.toContain('process.env');
    expect(spec).toMatch(/let activationKey/);
    expect(spec).toMatch(/toHaveValue\(\/\^\(\?!\)\.\+\$\/\)/);
  });

  test('stale specs no longer depend on a hard-coded historical license marker', () => {
    expect(read('tests/emukey/e2e/web/user-license-run.spec.ts')).not.toContain('EMU-D767CD7315A46AA9AD6');
    expect(read('tests/emukey/e2e/web/phase6-license-flow.spec.ts')).not.toContain('E2E_ACTIVATION_KEY');
  });
});
