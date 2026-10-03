import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createClient } from '@hey-api/openapi-ts';

const root = resolve(import.meta.dirname, '..');
const input = join(root, 'openapi', 'openapi.json');
const check = process.argv.includes('--check');
const temporaryDirectory = check
  ? await mkdtemp(join(root, '.openapi-check-'))
  : undefined;
const outputDirectory = temporaryDirectory
  ? join(temporaryDirectory, 'generated')
  : join(root, 'src', 'infrastructure', 'api', 'generated');
const output = outputDirectory;
const prettierExecutable = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prettier.cmd' : 'prettier',
);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

try {
  const backendSpecificationPath = join(root, '..', 'backend', 'docs', 'openapi', 'openapi.json');
  // Compare to the authority in a monorepo checkout, while preserving standalone builds.
  if (existsSync(backendSpecificationPath)) {
    const backendSpecification = await readFile(backendSpecificationPath, 'utf8');
    if (await readFile(input, 'utf8') !== backendSpecification) {
      throw new Error('Client OpenAPI input differs from backend/docs/openapi/openapi.json; synchronize it before generating clients');
    }
  }
  await createClient({
    input,
    output: { path: output },
    plugins: ['@hey-api/typescript'],
  });
  run(prettierExecutable, [
    '--config',
    join(root, '.prettierrc.json'),
    '--write',
    output,
  ]);

  if (check) {
    for (const file of ['index.ts', 'types.gen.ts']) {
      const expected = await readFile(
        join(root, 'src', 'infrastructure', 'api', 'generated', file),
        'utf8',
      );
      const actual = await readFile(join(outputDirectory, file), 'utf8');
      const normalize = (value) => value.replaceAll('\r\n', '\n').trimEnd();
      if (normalize(actual) !== normalize(expected)) {
        throw new Error(
          `Generated API client is out of date (${file}); run the OpenAPI generate script`,
        );
      }
    }
  }
} finally {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
