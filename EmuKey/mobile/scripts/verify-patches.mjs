// Built-in-only bootstrap. Run before loading Expo, Metro or Jest.
// This is a GHSA-fc5q-39xc-vjpf mitigation, NOT arbitrary-pattern ReDoS safety.
// Only recognized repeated extglobs are prohibited. noext/noextglob and the
// parser's ?-leading, quoted or escaped inert interpretations remain unchanged.
// Raw regex syntax and externally supplied parsed states remain trusted inputs.
// Jest DEFAULT_TEST_MATCH is deliberately unsupported; use the configured
// **/*.test.ts?(x) or finite brace alternatives. Braces do not emulate repetition.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const mobileRoot = resolve(import.meta.dirname, '..');
export const advisoryId = 'GHSA-fc5q-39xc-vjpf';
const approved = {
  '2.3.2': {
    parser: '6b01b6882c6a3635bf4858c20789b927d66d8df5712d6dd822f923d3de578967',
    patch: '27cdcd4e5c0370a5efc313351206ddae93356ed0fcbc745ab3bba7a80a31dd06',
  },
  '4.0.7': {
    parser: '624708de9c9bf7fde6e39f24d4a37702eebf14604030afb975070b9bdbe6866d',
    patch: '9df9198007bfb7b47fe852e50fe15758cfd5cab01d9184f62b0b33e00fd2de6d',
  },
};

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function inside(root, target) {
  const suffix = relative(root, target);
  assert.ok(!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`), `module escapes installation: ${target}`);
}

export function readManifest(directory) {
  const file = join(directory, 'package.json');
  assert.ok(statSync(file).size <= 1_000_000, 'oversized package manifest');
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Node's bare-package search locations, without executing package code or
// requiring package.json to be exported. Audit paths describe package edges.
export function resolvePackage(owner, name, modulesRoot) {
  assert.match(name, /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_][a-z0-9_.-]*$/i, 'invalid package edge');
  const search = createRequire(join(owner, 'package.json')).resolve.paths(name);
  assert.ok(Array.isArray(search), 'invalid package search');
  for (const location of search) {
    const candidate = join(location, name);
    if (!existsSync(join(candidate, 'package.json'))) continue;
    const directory = realpathSync(candidate);
    inside(modulesRoot, directory);
    assert.equal(readManifest(directory).name, name, `package edge name mismatch: ${name}`);
    return directory;
  }
  throw new Error(`unresolved package edge: ${name}`);
}

export function inspectModules(modulesDirectory) {
  const modulesRoot = realpathSync(modulesDirectory);
  const pending = [modulesRoot];
  const visited = new Set();
  const packages = [];
  const copies = [];
  while (pending.length) {
    const directory = pending.pop();
    if (visited.has(directory)) continue;
    visited.add(directory);
    assert.ok(visited.size <= 250_000, 'module traversal limit exceeded');
    const entries = readdirSync(directory, { withFileTypes: true });
    if (entries.some(entry => entry.name === 'package.json' && (entry.isFile() || entry.isSymbolicLink()))) {
      inside(modulesRoot, realpathSync(join(directory, 'package.json')));
      const manifest = readManifest(directory);
      if (typeof manifest.name === 'string') packages.push({ directory, manifest });
      if (manifest.name === 'picomatch') {
        assert.equal(typeof manifest.version, 'string', 'invalid picomatch version');
        assert.ok(Object.hasOwn(approved, manifest.version), `unapproved picomatch version: ${manifest.version}`);
        const parser = realpathSync(join(directory, 'lib/parse.js'));
        inside(modulesRoot, parser);
        const hash = sha256(parser);
        assert.equal(hash, approved[manifest.version].parser, `unapproved parser hash: ${parser}`);
        copies.push({ directory, parser, version: manifest.version, sha256: hash });
      }
    }
    for (const entry of entries) {
      const target = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const real = realpathSync(target); // dangling links are a verification failure
        inside(modulesRoot, real);
        if (statSync(real).isDirectory()) pending.push(real);
      } else if (entry.isDirectory()) {
        pending.push(target);
      }
    }
  }
  assert.ok(copies.length > 0, 'no physical picomatch copies found');
  return { modulesRoot, packages, copies };
}

export function runNodeProbe(code, args, timeout = 5_000) {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  const child = spawnSync(process.execPath, ['--input-type=commonjs', '-e', code, ...args], {
    encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 128_000, windowsHide: true, shell: false, env,
  });
  assert.ok(!child.error && !child.signal && child.status === 0,
    `probe failed: ${child.error?.code ?? child.signal ?? child.status}; ${child.stderr?.slice(-2_000)}`);
  let result;
  try { result = JSON.parse(child.stdout); } catch { throw new Error('invalid probe result'); }
  assert.equal(result.ok, true, 'invalid probe result');
  return result;
}

const parserProbe = String.raw`
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const directory = process.argv[1];
const entries = [directory, path.join(directory, 'lib/picomatch.js')];
if (fs.existsSync(path.join(directory, 'posix.js'))) entries.push(path.join(directory, 'posix.js'));
const unsafe = ['+(*)', '+(*a)', '*(a)', '+(a|aa)', '+(ab|cd)', '*()', '+(',
  '@(+(a))+b', '?(+(a))', '!(+(a))', '{x,+(a)}', '**/+(a).js',
  '*(a)'.repeat(24)+'b', '+(a)'.repeat(18)+'b', '**/?(*.)+(spec|test).[tj]s?(x)'];
for (const entry of entries) {
  const pm = require(entry);
  for (const pattern of unsafe) for (const options of [{}, {maxExtglobRecursion:false},
    {maxExtglobRecursion:Infinity}, {fastpaths:false}, {regex:false}, {capture:true}, {windows:true}]) {
    for (const compile of [pm, pm.makeRe, pm.parse]) assert.throws(() => compile(pattern, options),
      error => error instanceof SyntaxError && error.message.startsWith('EMUKEY_UNSAFE_REPEATED_EXTGLOB:'));
  }
  for (const windows of [true, false]) for (const [input, pattern, expected] of [
    ['src/App.tsx','**/*.{ts,tsx}',true], ['src/App.js','**/*.{ts,tsx}',false],
    ['unit/a.test.tsx','**/*.test.ts?(x)',true], ['unit/a.test.ts','**/*.test.ts?(x)',true],
    ['src/a.ts','**/!(*.test).ts',true], ['src/a.test.ts','**/!(*.test).ts',false],
    ['src/a.ts','**/*',true], ['a.spec.js','**/*.{spec,test}.js',true],
    ['+?a','+(?a)',true], ['x?a','*(?a)',true]]) {
    assert.equal(pm.isMatch(input,pattern,{windows}),expected,pattern);
  }
  for (const options of [{noextglob:true},{noext:true}]) {
    // These disable recognition; no repeated group is emitted. Assert actual
    // inert semantics and execute a failing adversarial input under the deadline.
    assert.equal(pm.isMatch('+a','+(a)',options),true);
    assert.equal(pm.isMatch('a'.repeat(35)+'!','+(*a)',options),false);
    assert.equal(pm.isMatch('a'.repeat(35)+'!','*(a)',options),false);
  }
}
const pm=require(directory);
const branches=Array.from({length:9000},(_,i)=>'a'+i.toString(36).padStart(3,'0'));
for (const op of ['!','?','@']) {
  const re=pm.makeRe(op+'('+branches.join('|')+')');
  assert.equal(re.test(branches[5000]),op!=='!');
  assert.equal(re.test('ZZZZ'),op==='!');
}
console.log(JSON.stringify({ok:true}));
`;

export function verifyInstallation(root = mobileRoot) {
  const lockfile = join(root, 'pnpm-lock.yaml');
  const lockHash = sha256(lockfile);
  const lock = readFileSync(lockfile, 'utf8');
  const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
  assert.equal(readManifest(root).packageManager, 'pnpm@11.25.0', 'unreviewed pnpm version');
  for (const [version, hashes] of Object.entries(approved)) {
    assert.equal(sha256(join(root, `patches/picomatch@${version}.patch`)), hashes.patch, 'unapproved patch bytes');
    assert.ok(workspace.split(/\r?\n/).includes(`  picomatch@${version}: patches/picomatch@${version}.patch`), 'missing exact patch registration');
    assert.ok(lock.split(/\r?\n/).includes(`  picomatch@${version}: ${hashes.patch}`), 'missing frozen patch hash');
    assert.ok(lock.includes(`  picomatch@${version}(patch_hash=${hashes.patch}): {}`), 'missing patched snapshot');
    assert.ok(!lock.includes(`      picomatch: ${version}\n`) && !lock.includes(`      picomatch: ${version}\r\n`), 'unpatched dependency reference');
  }
  const inventory = inspectModules(join(root, 'node_modules'));
  const { modulesRoot, packages, copies } = inventory;
  const callers = [];
  for (const pkg of [{ directory: root, manifest: readManifest(root) }, ...packages]) {
    const edges = { ...pkg.manifest.dependencies, ...pkg.manifest.optionalDependencies, ...pkg.manifest.peerDependencies };
    if (!Object.hasOwn(edges, 'picomatch') && pkg.directory !== root) continue;
    const target = resolvePackage(pkg.directory, 'picomatch', modulesRoot);
    assert.ok(copies.some(copy => copy.directory === target), 'caller uses unverified parser');
    const actual = realpathSync(createRequire(join(pkg.directory, 'package.json')).resolve('picomatch'));
    assert.equal(dirname(actual), target, 'unexpected picomatch entrypoint');
    callers.push({ name: pkg.manifest.name, directory: pkg.directory, target });
  }
  for (const name of ['micromatch', 'anymatch', 'jest-util', '@expo/cli', '@expo/metro-config']) {
    assert.ok(callers.some(caller => caller.name === name), `missing toolchain caller: ${name}`);
  }
  for (const copy of copies) runNodeProbe(parserProbe, [copy.directory]);
  for (const pkg of packages.filter(pkg => pkg.manifest.name === 'micromatch')) {
    runNodeProbe(String.raw`
      const assert=require('node:assert/strict'), mm=require(process.argv[1]);
      for(const compile of [p=>mm(['aaaa!'],p),mm.makeRe,mm.parse,p=>mm.capture(p,'aaaa!')])
        assert.throws(()=>compile('+(*a)'), /EMUKEY_UNSAFE_REPEATED_EXTGLOB/);
      assert.deepEqual(mm(['a.test.ts','a.test.tsx','a.ts'],'**/*.test.ts?(x)'),['a.test.ts','a.test.tsx']);
      console.log(JSON.stringify({ok:true}));`, [pkg.directory]);
  }
  for (const copy of copies) assert.equal(sha256(copy.parser), copy.sha256, 'parser changed during verification');
  assert.equal(sha256(lockfile), lockHash, 'lockfile changed during verification');
  return { status: 'VERIFIED_LOCAL_MITIGATION', advisory: advisoryId, lockHash, copies, callers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'unexpected verifier arguments');
    console.log(JSON.stringify(verifyInstallation(), null, 2));
  } catch (error) {
    console.error(`PATCH_VERIFICATION_FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
