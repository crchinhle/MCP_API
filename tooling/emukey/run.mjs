import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

const workspace = resolve(import.meta.dirname, '../..');
const product = join(workspace, 'EmuKey');
const verification = join(import.meta.dirname, 'verification');
const [task, ...extra] = process.argv.slice(2);

// Reuse the product's installed dependencies. These ignored links contain no
// copied source and are never needed by a standalone product checkout.
function isMissing(link) {
  try {
    lstatSync(link);
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
  // A dangling symlink exists as a directory entry but resolves to nothing.
  return !existsSync(link);
}

function dependencies(directory, component) {
  const target = join(product, component, 'node_modules');
  if (!existsSync(target)) throw new Error(`Install dependencies in ${join(product, component)} first.`);
  const destination = join(workspace, directory, 'node_modules');
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const link = join(destination, entry.name);
    if (!isMissing(link)) continue;
    // Remove a stale entry so a previously dangling link cannot keep pointing
    // at an uninstalled dependency on an incremental or reused workspace.
    rmSync(link, { force: true, recursive: true });
    symlinkSync(join(target, entry.name), link, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

const suites = {
  'backend:unit': ['backend', 'vitest/vitest.mjs', ['run', '--config', join(verification, 'vitest.backend.config.ts'), 'unit']],
  'backend:integration': ['backend', 'vitest/vitest.mjs', ['run', '--config', join(verification, 'vitest.backend.config.ts'), 'integration', '--maxWorkers=1']],
  'backend:security': ['backend', 'vitest/vitest.mjs', ['run', '--config', join(verification, 'vitest.backend.config.ts'), 'security', '--maxWorkers=1']],
  'backend:contract': ['backend', 'vitest/vitest.mjs', ['run', '--config', join(verification, 'vitest.backend.config.ts'), 'contract']],
  'frontend:unit': ['frontend', 'vitest/vitest.mjs', ['run', '--config', join(verification, 'vitest.frontend.config.cjs'), '--maxWorkers=1']],
  'frontend:e2e': ['frontend', '@playwright/test/cli.js', ['test', '--config', join(verification, 'playwright.frontend.config.mjs')]],
  'mobile:unit': ['mobile', 'jest/bin/jest.js', ['--config', join(verification, 'jest.mobile.config.cjs'), '--runInBand']],
};

let cwd = workspace;
let args;
if (suites[task]) {
  const [component, executable, options] = suites[task];
  dependencies('tooling/emukey/verification', 'backend');
  dependencies(`tests/emukey/${task === 'frontend:e2e' ? 'e2e/web' : component}`, component);
  cwd = join(product, component);
  args = [join(cwd, 'node_modules', executable), ...options, ...extra];
} else if (/^(frontend|mobile):[a-z.-]+$/.test(task ?? '')) {
  const [component, script] = task.split(':');
  const directory = join(verification, `${component}-scripts`);
  const executable = join(directory, `${script}.mjs`);
  if (!existsSync(executable)) throw new Error(`Unknown task ${task}`);
  dependencies(`tooling/emukey/verification/${component}-scripts`, component);
  cwd = join(product, component);
  args = [executable, ...extra];
} else if (task === 'contracts') {
  dependencies('tests/emukey/contracts', 'backend/contracts');
  cwd = join(product, 'backend/contracts');
  args = [join(cwd, 'node_modules/hardhat/dist/src/cli.js'), 'test', 'nodejs', join(workspace, 'tests/emukey/contracts/LicenseRegistry.ts'), ...extra];
} else if (task?.startsWith('verify:') && /^[a-z-]+$/.test(task.slice(7)) && existsSync(join(verification, `${task.slice(7)}.mjs`))) {
  dependencies('tooling/emukey/verification', 'backend');
  cwd = join(product, task === 'verify:check-public-surface' ? 'backend/contracts' : 'backend');
  args = [join(verification, `${task.slice(7)}.mjs`), ...extra];
} else if (task === 'baseline') {
  args = [join(verification, 'validate-baseline.mjs'), ...extra];
} else {
  throw new Error(`Unknown task ${task}. Use: ${['baseline', ...Object.keys(suites)].join(', ')}`);
}
const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
