import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

function probe(code: string) {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=commonjs', '-e', `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const entrypoints = new Set([
      require.resolve('picomatch'),
      ...['micromatch', 'anymatch', 'jest-util'].map(caller => createRequire(require.resolve(caller)).resolve('picomatch')),
    ]);
    ${code}
  `], { cwd: resolve(__dirname, '../../../../EmuKey/mobile'), encoding: 'utf8', timeout: 3_000, windowsHide: true }));
}

describe('mobile constrained glob security profile', () => {
  it('rejects repeated extglobs through every installed caller and entry point', () => {
    const result = probe(`
      const patterns = ['+(*)', '+(*a)', '*(a)', '+(a|aa)', '@(+(a))+b', '*(a)'.repeat(24) + 'b', '+(a)'.repeat(18) + 'b'];
      let checked = 0;
      for (const entry of entrypoints) {
        const pm = require(entry);
        for (const pattern of patterns) {
          for (const options of [{}, {maxExtglobRecursion: false}]) {
            for (const compile of [pm, pm.makeRe, pm.parse]) {
              assert.throws(() => compile(pattern, options), error => error instanceof SyntaxError && error.message.includes('EMUKEY_UNSAFE_REPEATED_EXTGLOB'));
              checked++;
            }
          }
        }
      }
      assert.throws(() => require('micromatch')(['aaaa!'], '+(*a)'), /EMUKEY_UNSAFE_REPEATED_EXTGLOB/);
      console.log(JSON.stringify({checked, copies: entrypoints.size}));
    `);
    expect(result.copies).toBeGreaterThan(0);
    expect(result.checked).toBe(result.copies * 42);
  });

  it('keeps the configured Jest, Expo, optional and negative glob patterns usable', () => {
    expect(probe(`
      const examples = [
        ['src/App.tsx', '**/*.{ts,tsx}', true],
        ['src/App.js', '**/*.{ts,tsx}', false],
        ['unit/chat.test.tsx', '**/*.test.ts?(x)', true],
        ['src/main.ts', '**/!(*.test).ts', true],
        ['src/main.test.ts', '**/!(*.test).ts', false],
      ];
      for (const entry of entrypoints) for (const [path, pattern, expected] of examples) {
        assert.equal(require(entry).isMatch(path, pattern, {windows: false}), expected);
      }
      // ?-leading bodies are not recognized extglobs in these exact versions.
      for (const entry of entrypoints) {
        const pm = require(entry);
        assert.equal(pm.isMatch('x?a', '*(?a)'), true);
        assert.equal(pm.isMatch('aaaa!', '*(?a)'), false);
        assert.throws(() => pm('**/?(*.)+(spec|test).[tj]s?(x)'), /EMUKEY_UNSAFE_REPEATED_EXTGLOB/);
      }
      console.log(JSON.stringify(true));
    `)).toBe(true);
  });

  it('does not run the quadratic repeated-body analyzer for optional or negative groups', () => {
    expect(probe(`
      const body = Array.from({length: 9000}, (_, index) => 'a' + index.toString(36).padStart(3, '0')).join('|');
      for (const entry of entrypoints) for (const op of ['!', '?']) {
        const matcher = require(entry).makeRe(op + '(' + body + ')');
        assert.equal(matcher.test('a000'), op === '?');
        assert.equal(matcher.test('ZZZZ'), op === '!');
      }
      console.log(JSON.stringify(true));
    `)).toBe(true);
  });
});
