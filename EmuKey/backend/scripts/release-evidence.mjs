import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const run = promisify(execFile);
const root = resolve(process.cwd(), '..');
const runId = process.env.RELEASE_RUN_ID ?? `release-${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)}`;
const outputDirectory = resolve(root, 'docs/traceability/releases', runId);
await mkdir(outputDirectory, { recursive: true });

async function command(command, args, cwd = root) {
  try {
    const result = await run(command, args, { cwd, timeout: 120_000, windowsHide: true });
    return { status: 'PASS', output: `${result.stdout}${result.stderr}`.slice(-12_000) };
  } catch (error) {
    return { status: 'FAIL', output: `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`.slice(-12_000) };
  }
}

const git = await command('git', ['rev-parse', 'HEAD']);
const workingTree = await command('git', ['status', '--short']);
const baseline = await command('node', ['backend/scripts/validate-baseline.mjs']);
const releaseCheck = await command('node', ['scripts/release-check.mjs'], resolve(root, 'backend'));
const security = await command('node', ['scripts/security-scan.mjs'], resolve(root, 'backend'));
const dependencyAudit = await command('node', ['scripts/dependency-audit.mjs'], resolve(root, 'backend'));
const contractAddress = process.env.EVM_CONTRACT_ADDRESS ?? null;
const evidence = {
  runId,
  generatedAt: new Date().toISOString(),
  classification: 'LOCAL_VERIFIED',
  gitCommit: git.output.trim().split(/\s+/)[0] || 'unknown',
  workingTreeDirty: Boolean(workingTree.output.trim()),
  backendImage: process.env.RELEASE_BACKEND_IMAGE ?? null,
  frontendArtifact: process.env.RELEASE_FRONTEND_ARTIFACT ?? null,
  abi: 'backend/src/modules/blockchain/infrastructure/generated/license-registry.abi.json',
  contractAddress,
  chainId: process.env.EVM_CHAIN_ID ? Number(process.env.EVM_CHAIN_ID) : null,
  deploymentBlock: process.env.EVM_DEPLOYMENT_BLOCK ? Number(process.env.EVM_DEPLOYMENT_BLOCK) : null,
  schemaVersion: 'backend/database/schema.sql',
  openApiSnapshot: 'backend/docs/openapi/openapi.json',
  checks: { baseline, releaseCheck, security, dependencyAudit },
  redaction: { secretsPersisted: false, credentialValuesPersisted: false },
};
await writeFile(resolve(outputDirectory, 'release-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
const traceability = await readFile(resolve(root, 'docs/traceability/phase-8-traceability.md'), 'utf8');
await writeFile(resolve(outputDirectory, 'traceability-snapshot.md'), traceability, 'utf8');
const passed = [baseline, releaseCheck, security, dependencyAudit].every((check) => check.status === 'PASS');
console.log(JSON.stringify({ status: passed ? 'PASS' : 'FAIL', outputDirectory: `docs/traceability/releases/${runId}` }, null, 2));
if (!passed) process.exitCode = 1;
