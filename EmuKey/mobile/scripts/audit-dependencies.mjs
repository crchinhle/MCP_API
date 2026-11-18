// Native pnpm report, exact finding-level local mitigation, unchanged prod-high
// policy. No audit.ignore configuration and no persisted verification token.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { advisoryId, mobileRoot, readManifest, resolvePackage, sha256, verifyInstallation } from './verify-patches.mjs';

const levels = ['info', 'low', 'moderate', 'high', 'critical'];
function record(value) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), 'malformed audit object');
  return value;
}

export function assertAuditConfiguration(config) {
  record(config);
  assert.ok(!Object.hasOwn(config, 'error'), 'failed to inspect native audit configuration');
  for (const [key, value] of Object.entries(config)) {
    const normalized = key.replaceAll(/[-_]/g, '').toLowerCase();
    if (['fix', 'interactive', 'ignoreunfixable', 'ignoreregistryerrors', 'auditignoreprune'].includes(normalized)) {
      assert.ok(value === false || value == null, 'native audit mutation/suppression option is unsupported');
    }
    if (normalized === 'ignore') assert.equal(value, undefined, 'native audit ignore mode is unsupported');
    if (normalized === 'audit' || normalized === 'auditconfig') {
      record(value);
      for (const [setting, ignored] of Object.entries(value)) {
        if (/^ignore(?:Ghsas|Cves)?$/i.test(setting)) {
          assert.ok(Array.isArray(ignored) && ignored.length === 0, 'native audit ignore list must be empty');
        }
      }
    }
  }
}

export function classifyAuditResult(child, verified, root = mobileRoot) {
  assert.equal(verified?.status, 'VERIFIED_LOCAL_MITIGATION', 'missing patch verification');
  assert.equal(sha256(join(root, 'pnpm-lock.yaml')), verified.lockHash, 'installation lock changed');
  for (const copy of verified.copies) assert.equal(sha256(copy.parser), copy.sha256, 'verified parser changed');
  assert.ok(!child.error && !child.signal && (child.status === 0 || child.status === 1), 'audit process/network failure');
  const report = record(JSON.parse(child.stdout));
  assert.deepEqual(Object.keys(report).sort(), ['advisories', 'metadata'], 'unknown audit report shape');
  const advisories = record(report.advisories);
  const metadata = record(report.metadata);
  const counts = record(metadata.vulnerabilities);
  assert.deepEqual(Object.keys(counts).sort(), [...levels].sort(), 'malformed vulnerability counts');
  for (const value of Object.values(counts)) assert.ok(Number.isSafeInteger(value) && value >= 0, 'invalid vulnerability count');
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'totalDependencies']) {
    assert.ok(Number.isSafeInteger(metadata[key]) && metadata[key] >= 0, 'malformed dependency counts');
  }
  assert.equal(metadata.devDependencies, 0, 'audit is not production-only');
  const observed = Object.fromEntries(levels.map(level => [level, 0]));
  const mitigatedPaths = [];
  const fatal = [];
  const modulesRoot = realpathSync(join(root, 'node_modules'));
  const manifests = new Map();
  const targets = new Map();
  const manifest = directory => {
    if (!manifests.has(directory)) manifests.set(directory, readManifest(directory));
    return manifests.get(directory);
  };
  const validatePath = (findingPath, version) => {
    assert.equal(typeof findingPath, 'string', 'invalid audit path');
    assert.ok(findingPath.length <= 10_000, 'oversized audit path');
    const parts = findingPath.split('>');
    assert.ok(parts.length >= 2 && parts.length <= 100 && parts.shift() === '.' && parts.at(-1) === 'picomatch', 'invalid finding path');
    let owner = root;
    for (const name of parts) {
      const pkg = manifest(owner);
      const edges = owner === root
        ? { ...pkg.dependencies, ...pkg.optionalDependencies }
        : { ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies };
      assert.ok(Object.hasOwn(edges, name), `undeclared audit path edge: ${name}`);
      const key = `${owner}\0${name}`;
      if (!targets.has(key)) targets.set(key, resolvePackage(owner, name, modulesRoot));
      owner = targets.get(key);
    }
    const copy = verified.copies.find(copy => copy.directory === owner && copy.version === version);
    assert.ok(copy, `unverified audit path/version: ${findingPath} @ ${version}`);
    assert.equal(manifest(owner).version, version, 'finding version differs from installed package');
    assert.equal(sha256(copy.parser), copy.sha256, 'finding parser changed');
  };
  const ids = new Set();
  for (const [key, value] of Object.entries(advisories)) {
    const advisory = record(value);
    assert.ok(Number.isSafeInteger(advisory.id) && String(advisory.id) === key && advisory.id > 0, 'invalid advisory identifier');
    assert.ok(levels.includes(advisory.severity), 'unknown audit severity');
    assert.match(advisory.github_advisory_id, /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/, 'missing/invalid GHSA identifier');
    assert.ok(!ids.has(advisory.github_advisory_id), 'duplicate advisory identifier');
    ids.add(advisory.github_advisory_id);
    assert.equal(advisory.url, `https://github.com/advisories/${advisory.github_advisory_id}`, 'advisory URL/identifier mismatch');
    assert.equal(typeof advisory.module_name, 'string', 'missing advisory package');
    assert.ok(Array.isArray(advisory.findings) && advisory.findings.length > 0, 'missing audit findings');
    observed[advisory.severity]++;
    for (const finding of advisory.findings) {
      record(finding);
      assert.equal(typeof finding.version, 'string', 'missing finding version');
      assert.match(finding.version, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/, 'invalid finding version');
      assert.equal(finding.dev, false, 'unexpected development finding');
      assert.equal(typeof finding.optional, 'boolean', 'missing finding optional flag');
      assert.equal(finding.bundled, false, 'unsupported bundled finding');
      assert.ok(Array.isArray(finding.paths) && finding.paths.length > 0 && finding.paths.every(path => typeof path === 'string' && path.startsWith('.>')), 'missing finding paths');
      if (advisory.github_advisory_id === advisoryId) {
        assert.equal(advisory.module_name, 'picomatch', 'exception package mismatch');
        assert.equal(advisory.severity, 'high', 'advisory severity changed; review required');
        for (const path of finding.paths) {
          validatePath(path, finding.version);
          mitigatedPaths.push({ path, version: finding.version });
        }
      } else if (advisory.severity === 'high' || advisory.severity === 'critical') {
        fatal.push({ advisory: advisory.github_advisory_id, package: advisory.module_name, version: finding.version });
      }
    }
  }
  // Pinned pnpm 11 retains pre-filter counts. Missing/ignored findings therefore
  // fail here. Request info-level JSON for completeness, but enforce HIGH below.
  assert.deepEqual(observed, counts, 'incomplete or suppressed audit report');
  assert.equal(child.status, Object.keys(advisories).length ? 1 : 0, 'unexplained audit exit status');
  assert.equal(fatal.length, 0, `unmitigated production high/critical advisories: ${JSON.stringify(fatal)}`);
  return {
    status: mitigatedPaths.length ? 'PASS_WITH_LOCAL_MITIGATION' : 'PASS',
    policy: 'production high/critical', advisory: mitigatedPaths.length ? advisoryId : null,
    upstreamFixed: false,
    mitigation: mitigatedPaths.length ? 'EmuKey recognized repeated-extglob prohibition; arbitrary regex input remains outside this profile' : null,
    lockHash: verified.lockHash, vulnerabilities: counts, mitigatedPaths,
  };
}

export function auditMobile() {
  const verified = verifyInstallation(); // Always fresh, before invoking pnpm.
  const executable = process.platform === 'win32' ? process.execPath : 'corepack';
  const prefix = process.platform === 'win32'
    ? [join(dirname(process.execPath), 'node_modules/corepack/dist/corepack.js'), 'pnpm'] : ['pnpm'];
  const env = { ...process.env, COREPACK_DEFAULT_TO_LATEST: '0' };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  // No CLI ignore/fix mode may be inherited from npm/pnpm environment settings.
  for (const name of Object.keys(env)) {
    if (/^(?:npm|pnpm)_config_(?:ignore(?:_unfixable|_registry_errors)?|fix|interactive)$/i.test(name)) {
      throw new Error('ambient audit mutation/suppression option is unsupported');
    }
  }
  const options = { cwd: mobileRoot, encoding: 'utf8', timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 8_000_000, windowsHide: true, shell: false, env };
  const version = spawnSync(executable, [...prefix, '--version'], options);
  assert.ok(!version.error && version.status === 0 && version.stdout.trim() === '11.25.0', 'unreviewed audit tool version');
  const configuration = spawnSync(executable, [...prefix, 'config', 'list', '--json'], options);
  assert.ok(!configuration.error && configuration.status === 0, 'cannot inspect native audit configuration');
  assertAuditConfiguration(JSON.parse(configuration.stdout));
  // pnpm 11's fix option accepts a string as well as a boolean: even --no-fix
  // consumes the next argument. Inspect effective settings, then OMIT mutation
  // flags entirely rather than passing a false value that pnpm misinterprets.
  const child = spawnSync(executable, [...prefix, 'audit', '--prod', '--audit-level', 'info', '--json'], options);
  return classifyAuditResult(child, verified);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'unexpected audit arguments');
    console.log(JSON.stringify(auditMobile(), null, 2));
  } catch (error) {
    console.error(`MOBILE_AUDIT_FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
