import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const flow = resolve(process.cwd(), 'e2e/phase6-license-flow.yaml');
await access(flow);
if (!process.env.E2E_CUSTOMER_EMAIL || !process.env.E2E_CUSTOMER_PASSWORD) {
  console.log(JSON.stringify({ status: 'BLOCKED_EXTERNAL', blocker: 'BLOCKED_EXTERNAL_DEVICE_OR_TEST_IDENTITY', flow: 'e2e/phase6-license-flow.yaml' }, null, 2));
  process.exitCode = 2;
} else {
  console.log(JSON.stringify({ status: 'READY_FOR_DEVICE', flow: 'e2e/phase6-license-flow.yaml' }, null, 2));
}
