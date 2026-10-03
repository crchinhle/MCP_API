import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const flow = resolve(import.meta.dirname, '../../../../tests/emukey/e2e/mobile/phase6-license-flow.yaml');
await access(flow);
if (!process.env.E2E_CUSTOMER_EMAIL || !process.env.E2E_CUSTOMER_PASSWORD) {
  console.log(JSON.stringify({ status: 'BLOCKED_EXTERNAL', blocker: 'BLOCKED_EXTERNAL_DEVICE_OR_TEST_IDENTITY', flow: 'tests/emukey/e2e/mobile/phase6-license-flow.yaml' }, null, 2));
  process.exitCode = 2;
} else {
  console.log(JSON.stringify({ status: 'READY_FOR_DEVICE', flow: 'tests/emukey/e2e/mobile/phase6-license-flow.yaml' }, null, 2));
}
