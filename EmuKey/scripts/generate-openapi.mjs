import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const backendSpecification = join(
  root,
  'backend',
  'docs',
  'openapi',
  'openapi.json',
);

function run(component, script) {
  const args = [join(root, component, 'scripts', 'generate-openapi.mjs')];
  if (script) {
    args.push(`--${script}`);
  }
  const result = spawnSync(
    'node',
    args,
    {
      cwd: join(root, component),
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `${component}: openapi:${script} exited with status ${result.status ?? 'unknown'}`,
    );
  }
}

run('backend', check ? 'check' : 'generate');

for (const component of ['frontend', 'mobile']) {
  const componentOpenApiDirectory = join(root, component, 'openapi');
  const componentSpecification = join(
    componentOpenApiDirectory,
    'openapi.json',
  );

  if (check) {
    const backendContent = await readFile(backendSpecification, 'utf8');
    const componentContent = await readFile(componentSpecification, 'utf8');
    if (backendContent !== componentContent) {
      throw new Error(
        `${component}/openapi/openapi.json is not synchronized with backend`,
      );
    }
  } else {
    await mkdir(componentOpenApiDirectory, { recursive: true });
    await copyFile(backendSpecification, componentSpecification);
  }

  run(component, check ? 'check' : 'generate');
}
