import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Exercise Expo's actual Node tooling rather than Jest's mocked RN runtime.
function runFingerprintTool(code: string): string {
  return execFileSync(process.execPath, ['--input-type=commonjs', '-e', `
    const { createRequire } = require('node:module');
    const fingerprint = createRequire(require.resolve('@expo/fingerprint'));
    const paths = fingerprint('./utils/Path');
    ${code}
  `], { cwd: resolve(__dirname, '../../../../EmuKey/mobile'), encoding: 'utf8', timeout: 3_000, windowsHide: true });
}

describe('Expo fingerprint dependency compatibility', () => {
  it('bounds adversarial path preprocessing at the configured expansion limit', () => {
    // GHSA-g3hv-75wg-m249: repeated **/../ amplified intermediate glob parts.
    const count = Number(runFingerprintTool(`
      const { Minimatch } = fingerprint('minimatch');
      const matcher = new Minimatch(Array(8).fill('**/../a/b').join('/'), { optimizationLevel: 2, braceExpandMax: 64 });
      process.stdout.write(String(matcher.set.length));
    `));
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(64);
  });

  it('preserves Android build exclusions and native source inclusion', () => {
    expect(JSON.parse(runFingerprintTool(`
      const { DEFAULT_IGNORE_PATHS } = fingerprint('./Options');
      process.stdout.write(JSON.stringify([
        paths.isIgnoredPath('android/app/build/generated/File.java', DEFAULT_IGNORE_PATHS),
        paths.isIgnoredPath('android/app/src/main/MainActivity.kt', DEFAULT_IGNORE_PATHS),
        paths.isIgnoredPath('../../node_modules/pkg/native.node', DEFAULT_IGNORE_PATHS),
      ]));
    `))).toEqual([true, false, true]);
  });

  it('preserves explicit negation and Windows path normalization', () => {
    expect(JSON.parse(runFingerprintTool(`
      const patterns = ['**/android/**', '!**/android/keep/**'];
      process.stdout.write(JSON.stringify([
        paths.isIgnoredPath(paths.toPosixPath(require('node:path').join('android', 'generated', 'File.kt')), patterns),
        paths.isIgnoredPath('android/keep/File.kt', patterns),
        paths.isIgnoredPath(paths.toPosixPath('android/app/build/File.java'), ['**/build/**']),
      ]));
    `))).toEqual([true, false, true]);
  });
});
