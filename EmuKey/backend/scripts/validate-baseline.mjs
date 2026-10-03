import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultRepoRoot = resolve(backendRoot, '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : resolve(process.argv[index + 1] ?? '');
}

function fail(message) {
  throw new Error(message);
}

function expectedCapabilityIds() {
  const ranges = [
    ['AUTH', 4],
    ['CAT', 5],
    ['COM', 6],
    ['LIC', 8],
    ['BC', 5],
    ['AST', 4],
    ['OPS', 3],
  ];
  return ranges.flatMap(([prefix, count]) =>
    Array.from(
      { length: count },
      (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`,
    ),
  );
}

function sameMembers(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  if (missing.length || extra.length) {
    fail(
      `${label} drift; missing=[${missing.join(', ')}], extra=[${extra.join(', ')}]`,
    );
  }
}

async function existingFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function sourceFiles(root) {
  const result = [];
  if (!(await existingDirectory(root))) return result;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (['.git', 'dist', 'node_modules', 'coverage'].includes(entry.name))
      continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)));
    else if (
      ['.ts', '.tsx', '.js', '.mjs', '.json', '.yaml', '.yml'].includes(
        extname(entry.name),
      )
    ) {
      result.push(path);
    }
  }
  return result;
}

async function existingDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function assertNoForbiddenRuntimeReferences(repoRoot) {
  const roots = [
    resolve(repoRoot, 'backend', 'src'),
    resolve(repoRoot, 'frontend', 'src'),
    resolve(repoRoot, 'mobile', 'src'),
  ];
  const explicitFiles = [
    resolve(repoRoot, 'backend', 'package.json'),
    resolve(repoRoot, 'backend', 'pnpm-lock.yaml'),
    resolve(repoRoot, 'docker-compose.yml'),
    resolve(repoRoot, 'backend', 'docker-compose.yml'),
  ];
  const files = [
    ...(await Promise.all(roots.map((root) => sourceFiles(root)))).flat(),
    ...(
      await Promise.all(
        explicitFiles.map(async (path) =>
          (await existingFile(path)) ? [path] : [],
        ),
      )
    ).flat(),
  ];
  const forbidden = [
    [/[@/]nestjs[/]typeorm|\btypeorm_migrations\b|["']typeorm["']/i, 'TypeORM'],
    [
      /ContractSigningScreen|provider-signing|order-contract|test_client/i,
      'legacy business runtime',
    ],
    [/@google-cloud\/kms|cloudkms|aws.*kms|kms.*sign/i, 'KMS runtime'],
  ];
  for (const path of files) {
    const content = await readFile(path, 'utf8');
    for (const [pattern, label] of forbidden) {
      if (pattern.test(content)) fail(`${label} reference found in ${path}`);
    }
  }
}

async function assertNoLocalPostgresService(repoRoot) {
  for (const path of [
    resolve(repoRoot, 'docker-compose.yml'),
    resolve(repoRoot, 'backend', 'docker-compose.yml'),
  ]) {
    if (!(await existingFile(path))) continue;
    const content = await readFile(path, 'utf8');
    if (/^\s{2}(?:postgres|postgresql|database):\s*$/m.test(content)) {
      fail(`local PostgreSQL Compose service found in ${path}`);
    }
  }
}

async function assertAuthority(workspaceRoot, backendSchema) {
  const authorities = [
    ['chuc_nang_toan_he_thong_ver2.0.md', /baseline v5\.1/i],
    ['APP_IMPLEMENTATION_PLAN.md', /baseline v5\.1/i],
    ['cong_nghe_he_thong.md', /baseline v5\.1/i],
  ];
  for (const [name, headerPattern] of authorities) {
    const path = resolve(workspaceRoot, name);
    if (!(await existingFile(path))) continue;
    const header = (await readFile(path, 'utf8')).slice(0, 500);
    if (!headerPattern.test(header)) fail(`${name} header is not v5.1`);
  }

  const canonicalSchema = resolve(workspaceRoot, 'sql_minimal.sql');
  if (await existingFile(canonicalSchema)) {
    const [canonical, runtime] = await Promise.all([
      readFile(canonicalSchema),
      readFile(backendSchema),
    ]);
    const digest = (value) => createHash('sha256').update(value).digest('hex');
    if (digest(canonical) !== digest(runtime)) {
      fail('canonical sql_minimal.sql and backend/database/schema.sql differ');
    }
  }
}

async function validate() {
  const repoRoot = option('--repo', defaultRepoRoot);
  const traceabilityPath = option(
    '--traceability',
    resolve(repoRoot, 'docs', 'traceability', 'capabilities-v4.1.json'),
  );
  const schemaPath = option(
    '--schema',
    resolve(repoRoot, 'backend', 'database', 'schema.sql'),
  );
  const matrix = JSON.parse(await readFile(traceabilityPath, 'utf8'));
  const capabilities = matrix.capabilities ?? [];
  const ids = capabilities.map(({ id }) => id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) fail(`duplicate capability: ${duplicate}`);
  if (capabilities.length !== matrix.baseline?.capabilityCount) {
    fail('capability count does not match baseline metadata');
  }
  sameMembers(ids, expectedCapabilityIds(), 'capability catalog');

  for (const capability of capabilities) {
    for (const field of ['actor', 'owner', 'api', 'transaction', 'testOwner']) {
      if (
        typeof capability[field] !== 'string' ||
        capability[field].trim() === ''
      ) {
        fail(`${capability.id} is missing ${field}`);
      }
    }
    if (
      !Number.isInteger(capability.phase) ||
      capability.phase < 2 ||
      capability.phase > 7
    ) {
      fail(`${capability.id} has an invalid phase`);
    }
    if (!Array.isArray(capability.tables))
      fail(`${capability.id} is missing tables`);
    if (
      capability.phase <= 5 &&
      !(await existingFile(resolve(repoRoot, capability.testOwner)))
    ) {
      fail(
        `${capability.id} test owner does not exist: ${capability.testOwner}`,
      );
    }
  }

  const requiredOwners = {
    comparePlans: 'CAT-05',
    publicBlockchainVerification: 'BC-05',
    projectionReconcile: 'BC-04',
  };
  for (const [concern, owner] of Object.entries(requiredOwners)) {
    if (matrix.uniqueOwners?.[concern] !== owner) {
      fail(`${concern} must be owned by ${owner}`);
    }
  }

  const schema = await readFile(schemaPath, 'utf8');
  const tables = [
    ...schema.matchAll(/^\s*CREATE TABLE\s+([a-z_][a-z0-9_]*)/gim),
  ].map((match) => match[1]);
  sameMembers(tables, matrix.currentTables ?? [], 'SQL table inventory');
  if (!matrix.cryptoVectorOwner) fail('crypto vector owner is missing');
  if (!(await existingFile(resolve(repoRoot, matrix.cryptoVectorOwner)))) {
    fail(`crypto vector owner does not exist: ${matrix.cryptoVectorOwner}`);
  }

  await assertNoForbiddenRuntimeReferences(repoRoot);
  await assertNoLocalPostgresService(repoRoot);
  await assertAuthority(resolve(repoRoot, '..'), schemaPath);

  process.stdout.write(
    `Baseline valid: ${capabilities.length} capabilities, ${tables.length} tables, unique owners locked.\n`,
  );
}

validate().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
