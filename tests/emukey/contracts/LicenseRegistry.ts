import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import { network } from 'hardhat';
import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex } from 'viem';

type Vector = {
  entitlements: { hash: `0x${string}` };
  plan: {
    providerChainAddress: `0x${string}`;
    productId: string;
    planId: string;
    planVersion: number;
    durationMonths: number;
    maxActiveDevices: number;
    commitment: `0x${string}`;
  };
  activation: { commitment: `0x${string}` };
};

const vector = JSON.parse(
  await readFile(
    new URL('./test-vectors/crypto-v2.json', import.meta.url),
    'utf8',
  ),
) as Vector;
const bytes16 = (uuid: string) => `0x${uuid.replaceAll('-', '')}` as const;

describe('LicenseRegistry', async () => {
  const { viem } = await network.create();
  const wallets = await viem.getWalletClients();

  async function deploy() {
    return viem.deployContract('LicenseRegistry', [
      wallets[0].account.address,
      wallets[0].account.address,
    ]);
  }

  it('issues namespace licenses with the shared relayer and preserves lifecycle and legacy reads', async () => {
    const registry = await deploy();
    const namespace = keccak256(stringToHex('EMUKEY_PROVIDER_NAMESPACE_V1:provider-one'));
    const otherNamespace = keccak256(stringToHex('EMUKEY_PROVIDER_NAMESPACE_V1:provider-two'));
    const commitmentArgs = [namespace, bytes16(vector.plan.productId), bytes16(vector.plan.planId), 1n, 12n, 3n, vector.entitlements.hash] as const;
    const commitment = await registry.read.computePlanCommitmentForProvider(commitmentArgs);
    assert.equal(commitment, keccak256(encodeAbiParameters(parseAbiParameters('bytes32, bytes32, bytes16, bytes16, uint256, uint256, uint256, bytes32'), [keccak256(stringToHex('LICENSE_PLAN_COMMITMENT_V3')), ...commitmentArgs])));
    const otherCommitment = await registry.read.computePlanCommitmentForProvider([otherNamespace, ...commitmentArgs.slice(1)]);
    assert.notEqual(commitment, otherCommitment);
    const licenseId = bytes16('00000000-0000-4000-8000-000000000701');
    const commandId = bytes16('00000000-0000-4000-8000-000000000702');
    const args = [commandId, licenseId, namespace, bytes16(vector.plan.productId), bytes16(vector.plan.planId), 1n, commitment, vector.activation.commitment, 1n, 3n, BigInt(Math.floor(Date.now() / 1000)) + 86_400n] as const;
    await assert.rejects(registry.write.issueLicenseForProvider(args, { account: wallets[1].account }));
    await assert.rejects(registry.write.issueLicenseForProvider([args[0], args[1], `0x${'00'.repeat(32)}`, ...args.slice(3)]));
    await registry.write.issueLicenseForProvider(args);
    await assert.rejects(registry.write.issueLicenseForProvider(args));
    const otherLicenseId = bytes16('00000000-0000-4000-8000-000000000711');
    await registry.write.issueLicenseForProvider([bytes16('00000000-0000-4000-8000-000000000712'), otherLicenseId, otherNamespace, args[3], args[4], args[5], otherCommitment, ...args.slice(7)]);
    assert.equal(await registry.read.providerNamespaceForLicense([otherLicenseId]), otherNamespace);
    assert.equal(await registry.read.providerNamespaceForLicense([licenseId]), namespace);
    assert.equal((await registry.read.getLicense([otherLicenseId])).status, 1);
    const license = await registry.read.getLicense([licenseId]);
    assert.equal(license.provider, `0x${'00'.repeat(20)}`);
    assert.equal(license.status, 1);
    await registry.write.suspendLicense([bytes16('00000000-0000-4000-8000-000000000703'), licenseId]);
    await registry.write.resumeLicense([bytes16('00000000-0000-4000-8000-000000000704'), licenseId]);
    await registry.write.renewLicense([bytes16('00000000-0000-4000-8000-000000000705'), licenseId, args[10] + 86_400n]);
    await registry.write.syncActiveDeviceCount([bytes16('00000000-0000-4000-8000-000000000706'), licenseId, 1n, 1n]);
    await registry.write.rotateActivationKey([bytes16('00000000-0000-4000-8000-000000000707'), licenseId, keccak256(stringToHex('new-key')), 2n]);
    await registry.write.revokeLicense([bytes16('00000000-0000-4000-8000-000000000708'), licenseId]);
    assert.equal((await registry.read.getLicense([licenseId])).status, 3);
    assert.equal(await registry.read.providerNamespaceForLicense([licenseId]), namespace);
  });

  it('matches the frozen TypeScript commitment vector byte-for-byte', async () => {
    const registry = await deploy();
    const planCommitment = await registry.read.computePlanCommitment([
      vector.plan.providerChainAddress,
      bytes16(vector.plan.productId),
      bytes16(vector.plan.planId),
      BigInt(vector.plan.planVersion),
      BigInt(vector.plan.durationMonths),
      BigInt(vector.plan.maxActiveDevices),
       vector.entitlements.hash,
    ]);
    assert.equal(planCommitment, vector.plan.commitment);
  });

  it('rejects unauthorized and duplicate ISSUE commands while retaining canonical state', async () => {
    const registry = await deploy();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const args = [
      bytes16('00000000-0000-4000-8000-000000000501'),
      bytes16('00000000-0000-4000-8000-000000000401'),
      vector.plan.providerChainAddress,
      bytes16(vector.plan.productId),
      bytes16(vector.plan.planId),
      1n,
      vector.plan.commitment,
      vector.activation.commitment,
      1n,
      3n,
      now + 86_400n,
    ] as const;

    await assert.rejects(
      registry.write.issueLicense(args, { account: wallets[1].account }),
    );
    await registry.write.issueLicense(args);
    await assert.rejects(registry.write.issueLicense(args));
    await assert.rejects(
      registry.write.issueLicense([
        bytes16('00000000-0000-4000-8000-000000000599'),
        args[1],
        ...args.slice(2),
      ]),
    );

    const license = await registry.read.getLicense([args[1]]);
    assert.equal(await registry.read.providerNamespaceForLicense([args[1]]), `0x${'00'.repeat(32)}`);
    assert.equal(
      license.provider.toLowerCase(),
      vector.plan.providerChainAddress.toLowerCase(),
    );
    assert.equal(license.planCommitment, vector.plan.commitment);
    assert.equal(license.activationCommitment, vector.activation.commitment);
    assert.equal(license.activationKeyVersion, 1n);
    assert.equal(license.status, 1);
  });

  it('rejects zero plan commitments and zero plan or activation-key versions', async () => {
    const registry = await deploy();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const base = [
      bytes16('00000000-0000-4000-8000-000000000521'),
      bytes16('00000000-0000-4000-8000-000000000421'),
      vector.plan.providerChainAddress,
      bytes16(vector.plan.productId),
      bytes16(vector.plan.planId),
      1n,
      vector.plan.commitment,
      vector.activation.commitment,
      1n,
      3n,
      now + 86_400n,
    ] as const;

    await assert.rejects(
      registry.write.issueLicense([...base.slice(0, 6), 0n, ...base.slice(7)]),
    );
    await assert.rejects(
      registry.write.issueLicense([
        bytes16('00000000-0000-4000-8000-000000000522'),
        bytes16('00000000-0000-4000-8000-000000000422'),
        ...base.slice(2, 7),
        `0x${'00'.repeat(32)}`,
        ...base.slice(8),
      ]),
    );
    await assert.rejects(
      registry.write.issueLicense([
        bytes16('00000000-0000-4000-8000-000000000523'),
        bytes16('00000000-0000-4000-8000-000000000423'),
        ...base.slice(2, 9),
        0n,
        ...base.slice(10),
      ]),
    );
  });

  it('never places the raw activation secret in ISSUE calldata or events', async () => {
    const registry = await deploy();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const transactionHash = await registry.write.issueLicense([
      bytes16('00000000-0000-4000-8000-000000000524'),
      bytes16('00000000-0000-4000-8000-000000000424'),
      vector.plan.providerChainAddress,
      bytes16(vector.plan.productId),
      bytes16(vector.plan.planId),
      1n,
      vector.plan.commitment,
      vector.activation.commitment,
      1n,
      3n,
      now + 86_400n,
    ]);
    const publicClient = await viem.getPublicClient();
    const [transaction, receipt] = await Promise.all([
      publicClient.getTransaction({ hash: transactionHash }),
      publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      }),
    ]);
    const sentinel = vector.activation.secret.slice(2).toLowerCase();
    const encodedLogs = receipt.logs
      .flatMap((log) => [log.data, ...log.topics])
      .join(':')
      .toLowerCase();

    assert.equal(transaction.input.toLowerCase().includes(sentinel), false);
    assert.equal(encodedLogs.includes(sentinel), false);
  });

  it('enforces transition state and device quota', async () => {
    const registry = await deploy();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const licenseId = bytes16('00000000-0000-4000-8000-000000000402');
    await registry.write.issueLicense([
      bytes16('00000000-0000-4000-8000-000000000502'),
      licenseId,
      vector.plan.providerChainAddress,
      bytes16(vector.plan.productId),
      bytes16(vector.plan.planId),
      1n,
      vector.plan.commitment,
      vector.activation.commitment,
      1n,
      1n,
      now + 86_400n,
    ]);

    await assert.rejects(registry.write.syncActiveDeviceCount([
      bytes16('00000000-0000-0000-0000-000000000503'), licenseId, 1n, 1n,
    ], { account: wallets[1].account }));
    await registry.write.syncActiveDeviceCount([
      bytes16('00000000-0000-0000-0000-000000000503'), licenseId, 1n, 1n,
    ]);
    await assert.rejects(
      registry.write.syncActiveDeviceCount([
        bytes16('00000000-0000-0000-0000-000000000504'), licenseId, 1n, 1n,
      ]),
    );
    await assert.rejects(
      registry.write.syncActiveDeviceCount([
        bytes16('00000000-0000-0000-0000-000000000506'), licenseId, 2n, 2n,
      ]),
    );
    const populated = await registry.read.getLicense([licenseId]);
    assert.equal(populated.activeDevices, 1n);
    assert.equal(populated.deviceStateVersion, 1n);
    await registry.write.syncActiveDeviceCount([
      bytes16('00000000-0000-0000-0000-000000000517'), licenseId, 0n, 2n,
    ]);
    const empty = await registry.read.getLicense([licenseId]);
    assert.equal(empty.activeDevices, 0n);
    assert.equal(empty.deviceStateVersion, 2n);
    await assert.rejects(registry.write.syncActiveDeviceCount([
      bytes16('00000000-0000-0000-0000-000000000518'), licenseId, 1n, 1n,
    ]));
    await registry.write.suspendLicense([
      bytes16('00000000-0000-4000-8000-000000000505'),
      licenseId,
    ]);
    await assert.rejects(
      registry.write.suspendLicense([
        bytes16('00000000-0000-4000-8000-000000000506'),
        licenseId,
      ]),
    );
    await registry.write.resumeLicense([
      bytes16('00000000-0000-4000-8000-000000000507'),
      licenseId,
    ]);
    await registry.write.revokeLicense([
      bytes16('00000000-0000-4000-8000-000000000508'),
      licenseId,
    ]);
    await assert.rejects(
      registry.write.renewLicense([
        bytes16('00000000-0000-4000-8000-000000000509'),
        licenseId,
        now + 172_800n,
      ]),
    );
  });

  it('renews an expired license and rejects stale lifecycle transitions', async () => {
    const registry = await deploy();
    const publicClient = await viem.getPublicClient();
    const currentBlock = await publicClient.getBlock();
    const now = currentBlock.timestamp;
    const licenseId = bytes16('00000000-0000-4000-8000-000000000403');
    const expiry = now + 10n;
    await registry.write.issueLicense([
      bytes16('00000000-0000-4000-8000-000000000510'), licenseId,
      vector.plan.providerChainAddress, bytes16(vector.plan.productId),
      bytes16(vector.plan.planId), 1n, vector.plan.commitment,
      vector.activation.commitment, 1n, 2n, expiry,
    ]);
    await publicClient.request({
      method: 'evm_setNextBlockTimestamp',
      params: [Number(expiry + 1n)],
    });
    await publicClient.request({ method: 'evm_mine', params: [] });
    await assert.rejects(
      registry.write.suspendLicense([
        bytes16('00000000-0000-4000-8000-000000000511'), licenseId,
      ]),
    );
    await registry.write.renewLicense([
      bytes16('00000000-0000-4000-8000-000000000512'), licenseId, expiry + 86_400n,
    ]);
    assert.equal(await registry.read.effectiveStatus([licenseId]), 1);
    await registry.write.suspendLicense([
      bytes16('00000000-0000-4000-8000-000000000513'), licenseId,
    ]);
    await registry.write.resumeLicense([
      bytes16('00000000-0000-4000-8000-000000000514'), licenseId,
    ]);
    await registry.write.revokeLicense([
      bytes16('00000000-0000-4000-8000-000000000515'), licenseId,
    ]);
    await assert.rejects(
      registry.write.resumeLicense([
        bytes16('00000000-0000-4000-8000-000000000516'), licenseId,
      ]),
    );
  });
});
