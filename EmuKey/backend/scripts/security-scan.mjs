import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, resolve } from 'node:path';

const root = resolve(process.cwd(), '..');
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bxkeysib-[0-9a-f]{20,}\b/i,
  /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]{8,}@/i,
];
const piiPatterns = [
  /res\.json\([^)]*\b(?:email|phone|address|message)\b/i,
  /PublicLicenseVerificationDto[\s\S]*\b(?:email|phone|address)\b/i,
];
const activationPatterns = [
  /logger\.(?:info|warn|error|debug)\([^;\n]*(?:activationKey|activationSecret|keyMaterial|privateKey)/i,
  /console\.(?:log|warn|error)\([^;\n]*(?:activationKey|activationSecret|keyMaterial|privateKey)/i,
];
const findings = [];
const includeLocalEnvironment = process.env.SECURITY_SCAN_INCLUDE_LOCAL_ENV === 'true'
  || process.argv.includes('--include-local-env');

if (includeLocalEnvironment) {
  for (const localEnvironmentFile of ['.env', 'backend/.env']) {
    const content = await readFile(resolve(root, localEnvironmentFile), 'utf8').catch(() => '');
    if (!content) continue;
    const sensitiveKeys = content
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*(DATABASE_URL|.*(?:API_KEY|SECRET|PRIVATE_KEY|PASSWORD|JWT_SECRET))\s*=\s*(.+)$/i))
      .filter((match) => match?.[2]?.trim() && !/^(replace-with|replace_|test-|sandbox-|production-)/i.test(match[2].trim()));
    if (sensitiveKeys.length > 0) {
      findings.push({ type: 'ROTATION_REQUIRED', path: localEnvironmentFile, credentialCount: sensitiveKeys.length });
    }
  }
}

for (const relativePath of trackedFiles) {
  if (!['.ts', '.tsx', '.js', '.mjs', '.json', '.yml', '.yaml', '.sql', '.env', '.md', ''].includes(extname(relativePath))) continue;
  if (relativePath.includes('test-vectors') || relativePath.includes('/test/') || relativePath.startsWith('test/')) continue;
  const content = await readFile(resolve(root, relativePath), 'utf8').catch(() => '');
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      findings.push({ type: 'SECRET_PATTERN', path: relativePath, pattern: pattern.source });
      break;
    }
  }
  if (/public|verify|chain.*event|event.*chain/i.test(relativePath)) {
    for (const pattern of piiPatterns) if (pattern.test(content)) findings.push({ type: 'PII_SURFACE', path: relativePath, pattern: pattern.source });
  }
  if (/log|logger|audit|telemetry|trace/i.test(relativePath)) {
    for (const pattern of activationPatterns) if (pattern.test(content)) findings.push({ type: 'ACTIVATION_PLAINTEXT_REVIEW', path: relativePath, pattern: pattern.source });
  }
}

if (findings.length > 0) {
  console.error(JSON.stringify({ status: 'FAIL', findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'PASS', trackedFilesScanned: trackedFiles.length, localEnvironmentScanned: includeLocalEnvironment, secretFilesScanned: true, piiSurfacesScanned: true, activationSurfacesScanned: true }, null, 2));
}
