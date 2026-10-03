import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createOpenApiDocument } from '../../platform/http/openapi.js';
import { createApiApplication } from './create-api-application.js';

const outputPath = resolve(
  process.argv[2] ?? 'docs/openapi/openapi.json',
);
const app = await createApiApplication({ logger: false });

try {
  await app.init();
  const document = createOpenApiDocument(app);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
} finally {
  await app.close();
}
