import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const validator = resolve(process.cwd(), 'scripts', 'validate-baseline.mjs');
const matrix = resolve(
  process.cwd(),
  '..',
  'docs',
  'traceability',
  'capabilities-v4.1.json',
);
const schema = resolve(process.cwd(), 'database', 'schema.sql');

describe('baseline validator', () => {
  it(
    'accepts the canonical Phase 1 traceability baseline',
    async () => {
      const result = await execFileAsync(process.execPath, [validator], {
        cwd: process.cwd(),
      });

      expect(result.stdout).toContain('35 capabilities');
      expect(result.stdout).toContain('18 tables');
    },
    15_000,
  );

  it('rejects a duplicated capability identifier', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emukey-baseline-'));
    const invalidMatrix = join(directory, 'capabilities.json');

    try {
      const document = JSON.parse(await readFile(matrix, 'utf8')) as {
        capabilities: { id: string }[];
      };
      document.capabilities[1]!.id = document.capabilities[0]!.id;
      await writeFile(invalidMatrix, JSON.stringify(document), 'utf8');

      let stderr = '';
      try {
        await execFileAsync(
          process.execPath,
          [validator, '--traceability', invalidMatrix],
          { cwd: process.cwd() },
        );
      } catch (error) {
        stderr = String((error as { stderr?: unknown }).stderr ?? error);
      }
      expect(stderr).toContain('duplicate capability');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('rejects a traceability matrix with a missing capability', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emukey-baseline-'));
    const invalidMatrix = join(directory, 'capabilities.json');

    try {
      const document = JSON.parse(await readFile(matrix, 'utf8')) as {
        capabilities: { id: string }[];
      };
      document.capabilities.pop();
      await writeFile(invalidMatrix, JSON.stringify(document), 'utf8');

      let stderr = '';
      try {
        await execFileAsync(
          process.execPath,
          [validator, '--traceability', invalidMatrix],
          { cwd: process.cwd() },
        );
      } catch (error) {
        stderr = String((error as { stderr?: unknown }).stderr ?? error);
      }
      expect(stderr).toContain('capability count does not match');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('rejects an active legacy business reference in runtime source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'emukey-baseline-'));
    const runtimeDirectory = join(directory, 'backend', 'src');
    const runtimeMatrix = join(directory, 'capabilities.json');

    try {
      await mkdir(runtimeDirectory, { recursive: true });
      const document = JSON.parse(await readFile(matrix, 'utf8')) as {
        capabilities: { testOwner: string }[];
        cryptoVectorOwner: string;
      };
      for (const capability of document.capabilities) {
        capability.testOwner = resolve(
          process.cwd(),
          '..',
          capability.testOwner,
        );
      }
      document.cryptoVectorOwner = resolve(
        process.cwd(),
        '..',
        document.cryptoVectorOwner,
      );
      await writeFile(runtimeMatrix, JSON.stringify(document), 'utf8');
      await writeFile(
        join(runtimeDirectory, 'legacy-runtime.ts'),
        "export const legacyModule = 'provider-signing';\n",
        'utf8',
      );

      let stderr = '';
      try {
        await execFileAsync(
          process.execPath,
          [
            validator,
            '--repo',
            directory,
            '--traceability',
            runtimeMatrix,
            '--schema',
            schema,
          ],
          { cwd: process.cwd() },
        );
      } catch (error) {
        stderr = String((error as { stderr?: unknown }).stderr ?? error);
      }
      expect(stderr).toContain('legacy business runtime reference');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
