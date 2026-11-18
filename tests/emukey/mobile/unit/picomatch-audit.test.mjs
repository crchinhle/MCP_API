import assert from 'node:assert/strict';
import { test, before } from 'node:test';

const script = new URL('../../../../EmuKey/mobile/scripts/audit-dependencies.mjs', import.meta.url);
let classify;
let verified;
let checkConfig;
before(async () => {
  ({ classifyAuditResult: classify, assertAuditConfiguration: checkConfig } = await import(script));
  const { verifyInstallation } = await import(new URL('./verify-patches.mjs', script));
  verified = verifyInstallation();
});

test('native audit configuration cannot hide findings or enable mutation', () => {
  for (const config of [{ audit: { ignore: ['GHSA-fc5q-39xc-vjpf'] } },
    { auditConfig: { ignoreGhsas: ['GHSA-fc5q-39xc-vjpf'] } },
    { fix: true }, { interactive: true }, { 'ignore-registry-errors': true }, { ignore: [] }]) {
    assert.throws(() => checkConfig(config));
  }
  checkConfig({ audit: { ignore: [], level: 'high' }, registry: 'https://registry.npmjs.org/' });
});

function report() {
  return {
    advisories: {
      '1247710': {
        id: 1247710, module_name: 'picomatch', severity: 'high',
        github_advisory_id: 'GHSA-fc5q-39xc-vjpf',
        url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
        findings: [{ version: '4.0.7', paths: ['.>expo>@expo/cli>picomatch'], dev: false, optional: false, bundled: false }],
      },
    },
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 }, dependencies: 1, devDependencies: 0, optionalDependencies: 0, totalDependencies: 1 },
  };
}
const result = value => ({ status: 1, signal: null, stdout: JSON.stringify(value), stderr: '' });

test('only the exact verified advisory finding gets a local mitigation result', () => {
  const outcome = classify(result(report()), verified);
  assert.equal(outcome.status, 'PASS_WITH_LOCAL_MITIGATION');
  assert.equal(outcome.mitigatedPaths.length, 1);
  assert.equal(outcome.upstreamFixed, false);
});

test('unknown paths, versions, packages, missing fields and mixed finding paths fail closed', () => {
  for (const change of [
    a => { a.findings[0].version = '4.0.6'; },
    a => { a.findings[0].paths = ['.>jest>picomatch']; },
    a => { a.findings[0].paths.push('.>expo>not-installed>picomatch'); },
    a => { a.findings[0].paths = []; },
    a => { delete a.findings[0].version; },
    a => { a.findings[0].dev = true; },
    a => { a.module_name = 'other'; },
    a => { a.url += '-extra'; },
    a => { a.github_advisory_id = 'GHSA-aaaa-bbbb-cccc'; },
  ]) {
    const value = report();
    change(value.advisories['1247710']);
    assert.throws(() => classify(result(value), verified));
  }
});

test('another high or critical advisory remains fatal, including picomatch', () => {
  for (const severity of ['high', 'critical']) {
    const value = report();
    value.advisories['2'] = { ...structuredClone(value.advisories['1247710']), id: 2, severity,
      github_advisory_id: 'GHSA-aaaa-bbbb-cccc', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' };
    value.metadata.vulnerabilities[severity]++;
    assert.throws(() => classify(result(value), verified), /unmitigated/);
  }
});

test('the pre-existing production high threshold still permits lower severity advisories', () => {
  const value = report();
  value.advisories['1247710'].severity = 'moderate';
  value.advisories['1247710'].github_advisory_id = 'GHSA-aaaa-bbbb-cccc';
  value.advisories['1247710'].url = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';
  value.metadata.vulnerabilities.high = 0;
  value.metadata.vulnerabilities.moderate = 1;
  assert.equal(classify(result(value), verified).status, 'PASS');
});

test('registry, process, truncated, inconsistent and unexplained exit results fail closed', () => {
  for (const invalid of [
    { ...result(report()), error: new Error('network unavailable') },
    { ...result(report()), signal: 'SIGTERM', status: null },
    { ...result(report()), status: 2 },
    { ...result(report()), status: 0 },
    { ...result(report()), stdout: '{"advisories":' },
    { ...result(report()), stdout: JSON.stringify({ error: { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE' } }) },
    result({ ...report(), metadata: { vulnerabilities: { high: 0 } } }),
  ]) assert.throws(() => classify(invalid, verified));
  assert.throws(() => classify(result(report()), { ...verified, status: 'SKIPPED' }));
});

test('a clean report passes but silently removed advisory records do not', () => {
  const clean = report();
  clean.advisories = {};
  assert.throws(() => classify({ ...result(clean), status: 0 }, verified), /incomplete or suppressed/);
  clean.metadata.vulnerabilities.high = 0;
  assert.equal(classify({ ...result(clean), status: 0 }, verified).status, 'PASS');
});
