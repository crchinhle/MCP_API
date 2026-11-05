import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ProviderDeliveryRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/provider-delivery.repository.js';
import { LicenseSecretCodec } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/license-secret-codec.js';
import { ProviderIntegrationRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/provider-integration.repository.js';
import { ProviderIntegrationService } from '../../../../../EmuKey/backend/src/modules/licensing/application/provider-integration.service.js';
import { ProviderHandoffService } from '../../../../../EmuKey/backend/src/modules/licensing/application/provider-handoff.service.js';
import { HttpProviderLicenseGateway } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/http-provider-license.gateway.js';
import { seedBaseline } from '../../../../../EmuKey/backend/src/platform/database/seed-baseline.js';
import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { CommerceRepository } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { CommerceService } from '../../../../../EmuKey/backend/src/modules/commerce-payment/application/commerce.service.js';
import { FakePaymentGateway } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { ChainCommandRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-command.repository.js';
import { ChainCommandService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/chain-command.service.js';
import { ChainIndexerCheckpointRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-indexer-checkpoint.repository.js';
import { ChainEventRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-event.repository.js';
import { ActivationEnvelopeRecoveryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { createProviderLicenseServer } from '../../../../../tooling/emukey/fixtures/provider-license-server.mjs';
import { randomUUID, randomBytes } from 'node:crypto';
import { LicensingRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/licensing.repository.js';
import { activationCommitment } from '../../../../../EmuKey/backend/src/platform/crypto/license-crypto.js';
import type {ChainEventType} from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-event.repository.js';
import { LicenseQueryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/license-query.service.js';
import { LicenseProjectionRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/license-projection.repository.js';
import { ActivationDeliveryRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/activation-delivery.repository.js';
import { applyUpgrade, schemaFingerprint, schemaDefinitions } from '../../../../../EmuKey/backend/src/platform/database/database-cli.js';
import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { IdentityService } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import { ProviderIntegrationController, ProviderDeliveryOperationsController } from '../../../../../EmuKey/backend/src/modules/licensing/presentation/provider-integration.controller.js';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ProviderDeliveryScheduler } from '../../../../../EmuKey/backend/src/modules/licensing/worker/provider-delivery.scheduler.js';
import { ProviderDeliveryProcessor, PROVIDER_DELIVERY_QUEUE } from '../../../../../EmuKey/backend/src/modules/licensing/worker/provider-delivery.processor.js';
import { LicenseController } from '../../../../../EmuKey/backend/src/modules/blockchain/presentation/license.controller.js';

const childFixture = process.env.EMUKEY_HANDOFF_CHILD;
const fixtureProvider = '00000000-0000-4000-8000-000000000002';
const fixtureCustomer = '00000000-0000-4000-8000-000000000004';

function handoffRuntime(pool: Pool, origin: string) {
  const codec = new LicenseSecretCodec('a'.repeat(64));
  const gateway = new HttpProviderLicenseGateway(origin);
  const configs = new ProviderIntegrationRepository(pool);
  const integration = new ProviderIntegrationService(configs, codec, gateway);
  const repo = new ProviderDeliveryRepository(pool);
  const handoff = new ProviderHandoffService(repo, configs, codec, gateway, integration, new NotificationRepository(pool));
  return { codec, gateway, configs, integration, repo, handoff };
}

describe.skipIf(Boolean(childFixture))('durable provider handoff storage', () => {
  let container: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').withDatabase('emukey_provider_handoff_fixture').start();
    redisContainer = await new RedisContainer('redis:8.2-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    await pool.query(await readFile(resolve(import.meta.dirname, '../../../../../EmuKey/backend/database/schema.sql'), 'utf8'));
  });
  afterAll(async () => { await pool?.end(); await redisContainer?.stop(); await container?.stop(); });

  it('installs handoff storage without replacing customer delivery receipts or legacy modes', async () => {
    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map((r) => r.tablename);
    expect(tables).toContain('provider_license_deliveries');
    expect(tables).toContain('license_key_materials');
    expect(tables).toContain('license_key_deliveries');
    const repo = new ProviderDeliveryRepository(pool);
    expect(await repo.claim()).toBeNull();
  });

  it('encrypts key material with its owner as authenticated context', () => {
    const codec = new LicenseSecretCodec('a'.repeat(64));
    const encrypted = codec.encrypt('secret-license', 'license:1');
    expect(JSON.stringify(encrypted)).not.toContain('secret-license');
    expect(codec.decrypt(encrypted, 'license:1')).toBe('secret-license');
    expect(() => codec.decrypt(encrypted, 'other-license:1')).toThrow();
    expect(() => new LicenseSecretCodec('b'.repeat(64)).decrypt(encrypted, 'license:1')).toThrow();
  });

  it('upgrades the continuity schema without losing users and matches a fresh handoff schema', async () => {
    const sql=await readFile(resolve(import.meta.dirname,'../../../../../EmuKey/backend/database/schema.sql'),'utf8');
    const fresh=await schemaDefinitions(pool as never);
    await pool.query(sql.replace(/-- emukey:handoff-ddl:begin[\s\S]*?-- emukey:handoff-ddl:end/,''));
    const retained=(await pool.query("INSERT INTO users(email,password_hash,display_name,role,status) VALUES ('retained@migration.test','hash','Retained','SYSTEM_ADMIN','ACTIVE') RETURNING id")).rows[0].id;
    const fingerprint=await schemaFingerprint(pool as never);
    const delta=sql.split('/* emukey:upgrade:cf17043:continuity_20261101:begin')[1]!.split('emukey:upgrade:end */')[0]!.trim().replaceAll('\r\n','\n');
    await pool.query('INSERT INTO schema_versions(version,checksum,schema_fingerprint) VALUES ($1,$2,$3)',[
      'continuity_20261101',createHash('sha256').update(delta).digest('hex'),fingerprint]);
    const client=await pool.connect();
    try {
      await expect(applyUpgrade(client as never,sql,'continuity_20261101','provider_handoff_20261104')).resolves.toBe('APPLIED');
      await expect(applyUpgrade(client as never,sql,'continuity_20261101','provider_handoff_20261104')).resolves.toBe('CURRENT');
      expect(await schemaDefinitions(client as never)).toEqual(fresh);
      expect((await client.query('SELECT display_name FROM users WHERE id=$1',[retained])).rows[0].display_name).toBe('Retained');
    } finally {client.release();}
  });

  it('hands the same paid key to the independent provider after a lost response and rejects fabricated keys', async () => {
    await seedBaseline(pool,'Handoff-test@123');
    await pool.query('CREATE DATABASE provider_fixture');
    const providerUrl = new URL(container.getConnectionUri()); providerUrl.pathname='/provider_fixture';
    const providerPool = new Pool({connectionString:providerUrl.toString()});
    const token = 'provider-test-token-never-embed-in-client';
    const providerId='00000000-0000-4000-8000-000000000002';
    const customer={role:'CUSTOMER' as const,sessionVersion:1,sub:'00000000-0000-4000-8000-000000000004'};
    const receiver = await createProviderLicenseServer({pool:providerPool,token,providerId});
    const origin = receiver.origin;
    try {
      const {configs,integration,repo,handoff}=handoffRuntime(pool,origin);
      const commands=new ChainCommandRepository(pool);
      const envelopes={prepare:async()=>{},read:async()=>null,consume:async()=>null,exists:async()=>false,remainingTtl:async()=>0};
      const chain={network:'sepolia',chainId:11155111,contractAddress:'0x5fbdb2315678afecb367f032d93f642f64180aa3'};
      const commerce=new CommerceService(new CommerceRepository(pool,86400,new NotificationRepository(pool),handoff),new FakePaymentGateway(token),envelopes,
        new ActivationEnvelopeRecoveryService(commands,envelopes,handoff),chain);
      await expect(commerce.createOrder(customer,randomUUID(),undefined,{planId:'00000000-0000-4000-8000-000000000301'})).rejects.toMatchObject({response:{code:'PROVIDER_INTEGRATION_NOT_READY'}});
      await integration.save(providerId,{endpointUrl:`${origin}/receive`,token,configVersion:0,authorized:true});
      await expect(integration.state(providerId,1,true)).rejects.toBeDefined();
      await integration.test(providerId); await integration.state(providerId,1,true);
      expect(await integration.get(providerId)).not.toHaveProperty('token');
      const actors={provider:{...customer,sub:providerId,role:'PROVIDER_ADMIN'},other:{...customer,sub:randomUUID(),role:'PROVIDER_ADMIN'},customer,support:{...customer,role:'SUPPORT_STAFF'}};
      const module=await Test.createTestingModule({controllers:[ProviderIntegrationController,ProviderDeliveryOperationsController],providers:[
        {provide:ProviderIntegrationService,useValue:integration},{provide:ProviderDeliveryRepository,useValue:repo},
        {provide:ProviderHandoffService,useValue:handoff},
        {provide:IdentityService,useValue:{authenticate:async(value:keyof typeof actors)=>{if(!actors[value]) throw new UnauthorizedException();return actors[value];}}},
      ]}).compile();
      const app=module.createNestApplication();app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));await app.init();
      try {
        const http=request(app.getHttpServer() as Server);
        await http.get('/provider/integration').expect(401);
        await http.get('/provider/integration').auth('customer',{type:'bearer'}).expect(403);
        const view=await http.get('/provider/integration').auth('provider',{type:'bearer'}).expect(200);
        expect(JSON.stringify(view.body)).not.toContain(token);
        const other=await http.get('/provider/integration').auth('other',{type:'bearer'}).expect(200);
        expect(other.body).toMatchObject({configVersion:0,hasCredential:false});
        await http.post(`/operations/license-deliveries/${randomUUID()}/retry`).auth('support',{type:'bearer'}).send({reason:'Not allowed'}).expect(403);
        await http.put('/provider/integration').auth('provider',{type:'bearer'}).send({endpointUrl:'https://example.test',configVersion:1,authorized:false}).expect(400);
      } finally {await app.close();}
      const order=await commerce.createOrder(customer,randomUUID(),undefined,{planId:'00000000-0000-4000-8000-000000000301'});
      const terms=await commerce.getServiceTerms(customer,order.id);
      await commerce.acceptServiceTerms(customer,order.id,{accepted:true,version:terms.version,hash:terms.hash});
      const checkout=await commerce.checkout(customer,order.id);
      await integration.state(providerId,1,false);
      await expect(commerce.createOrder(customer,randomUUID(),undefined,{planId:'00000000-0000-4000-8000-000000000301'})).rejects.toMatchObject({response:{code:'PROVIDER_INTEGRATION_NOT_READY'}});
      const payment={amountVnd:order.priceVndSnapshot,eventId:randomUUID(),occurredAt:new Date().toISOString(),providerReference:checkout.checkoutReference};
      const issued=await commerce.ingestIpn(payment,token);
      expect((await commerce.ingestIpn(payment,token)).classification).toBe('DUPLICATE');
      await integration.state(providerId,1,true);
      const command=(await pool.query('SELECT * FROM chain_commands WHERE id=$1',[issued.commandId])).rows[0];
      await expect(handoff.readCustomerKey(customer.sub,issued.licenseId!)).rejects.toBeDefined();
      const txHash=`0x${'31'.repeat(32)}`,blockHash=`0x${'32'.repeat(32)}`,relayer=`0x${'33'.repeat(20)}`;
      const broadcast=vi.fn();
      const submitter=new ChainCommandService(commands,{
        getSubmissionContext:async()=>({pendingNonce:0,relayerAddress:relayer}),
        prepare:async()=>({network:chain.network,nonce:0,relayerAddress:relayer,rawTransaction:'0x01',transactionHash:txHash}),
        broadcast,receipt:async()=>null,
      },envelopes,new ActivationEnvelopeRecoveryService(commands,envelopes,handoff),handoff);
      await submitter.processNext('provider-issue-worker');
      expect(broadcast).toHaveBeenCalledTimes(1);
      expect((await pool.query('SELECT status FROM chain_commands WHERE id=$1',[command.id])).rows[0].status).toBe('SUBMITTED');
      await commands.markReceipt(command.id,{blockHash,blockNumber:100,status:'SUCCESS',transactionHash:txHash});
      const checkpoints=new ChainIndexerCheckpointRepository(pool);
      expect(await checkpoints.pendingReceiptBlocks(chain)).toEqual([100]);
      expect(await checkpoints.pendingReceiptBlocks({...chain,contractAddress:`0x${'ff'.repeat(20)}`})).toEqual([]);
      const events=new ChainEventRepository(pool,undefined,handoff);
      const event=await events.ingest({blockHash,blockNumber:100,chainCommandId:command.id,chainId:chain.chainId,confirmationCount:2,contractAddress:chain.contractAddress,
        eventType:'LICENSE_ISSUED',licenseId:issued.licenseId!,logIndex:0,network:chain.network,payload:{activationCommitment:command.payload.activationCommitment,keyVersion:1,planCommitment:command.payload.planCommitment,providerAddress:command.payload.providerAddress},providerUserId:providerId,transactionHash:txHash});
      await events.confirm(event.id,2,blockHash);
      expect(await checkpoints.pendingReceiptBlocks(chain)).toEqual([]);
      receiver.setFault('DROP_AFTER_COMMIT');
      expect(await handoff.runOne()).toBe(true);
      expect((await repo.list(providerId))[0].status).toBe('RETRY_WAIT');
      await expect(handoff.readCustomerKey(customer.sub,issued.licenseId!)).rejects.toBeDefined();
      await pool.query("UPDATE provider_license_deliveries SET next_attempt_at=now() WHERE license_id=$1",[issued.licenseId]);
      receiver.setFault(null);
      await handoff.runOne();
      const key=await handoff.readCustomerKey(customer.sub,issued.licenseId!);
      const projections=new LicenseProjectionRepository(pool);
      const publicLicense=(await projections.findCustomer(customer.sub,issued.licenseId!))!;
      const publicView=await projections.findPublic(publicLicense.publicLicenseId);
      expect(publicView).toMatchObject({fulfillmentMode:'PROVIDER_HANDOFF',providerDeliveryStatus:'DELIVERED'});
      expect(JSON.stringify(publicView)).not.toContain(key.secret);
      // Crash/recovery drill: only the disposable DB, Redis and child processes
      // owned by this test are touched. Payment and chain remain fixtures.
      const connection=new Redis(redisContainer.getConnectionUrl(),{maxRetriesPerRequest:null});
      connection.on('error',()=>undefined);
      const children:Array<{process:ReturnType<typeof spawn>;exited:Promise<void>;url?:string}>=[];
      let diagnostics='';
      const startChild=(kind:'api'|'worker')=>{
        const process=spawn(globalThis.process.execPath,[resolve(globalThis.process.cwd(),'node_modules/vitest/vitest.mjs'),'run','--config',
          resolve(import.meta.dirname,'../../../../../tooling/emukey/verification/vitest.backend.config.ts'),fileURLToPath(import.meta.url),
          '--pool=threads','--maxWorkers=1',`--testNamePattern=handoff ${kind} child fixture`,'--reporter=dot'],{
          cwd:globalThis.process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...globalThis.process.env,
            EMUKEY_HANDOFF_CHILD:kind,EMUKEY_HANDOFF_FIXTURE_PG:container.getConnectionUri(),
            EMUKEY_HANDOFF_FIXTURE_REDIS:redisContainer.getConnectionUrl(),EMUKEY_HANDOFF_FIXTURE_ORIGIN:origin},
        });
        const child={process,exited:new Promise<void>((resolve,reject)=>{process.once('error',reject);process.once('close',()=>resolve());}),url:undefined as string|undefined};
        const capture=(data:Buffer)=>{const text=data.toString();diagnostics=(diagnostics+text).slice(-2000);const match=text.match(/EMUKEY_HANDOFF_API:(http:\/\/127\.0\.0\.1:\d+)/);if(match)child.url=match[1];};
        process.stdout?.on('data',capture);process.stderr?.on('data',capture);children.push(child);return child;
      };
      const stopChild=async(child:typeof children[number])=>{if(child.process.exitCode===null)child.process.kill('SIGKILL');await child.exited;};
      const readLicense=async(url:string)=>(await fetch(`${url}/licenses/${issued.licenseId}`,{headers:{Authorization:'Bearer customer'}})).json();
      let recoveredApi:string;
      try {
        await repo.transaction((tx)=>handoff.publish(tx,issued.licenseId!,'TRUST_CHANGED'));
        const pendingDelivery=(await repo.list(providerId))[0];
        const api=startChild('api');
        await expect.poll(()=>api.url,{timeout:30000}).toMatch(/^http:/);
        expect(await readLicense(api.url!)).toMatchObject({fulfillmentMode:'PROVIDER_HANDOFF',providerDeliveryStatus:'PENDING',activationKeyAvailable:false});
        receiver.setFault('HOLD_AFTER_COMMIT');
        const worker=startChild('worker');
        await expect.poll(async()=>(await providerPool.query('SELECT count(*)::int AS count FROM provider_receipts')).rows[0].count,{timeout:30000}).toBe(2);
        expect((await pool.query('SELECT status FROM provider_license_deliveries WHERE id=$1',[pendingDelivery.id])).rows[0].status).toBe('SENDING');
        await stopChild(worker);await stopChild(api);
        await connection.flushdb();await connection.save();await redisContainer.restart();
        // Docker Desktop can assign a different ephemeral host port on restart.
        // Both processes are restarted below using the container's current URL.
        connection.disconnect();
        await pool.query("UPDATE provider_license_deliveries SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[pendingDelivery.id]);
        receiver.setFault(null);
        startChild('worker');const replacement=startChild('api');
        await expect.poll(async()=>(await pool.query('SELECT status FROM provider_license_deliveries WHERE id=$1',[pendingDelivery.id])).rows[0].status,{timeout:30000}).toBe('DELIVERED');
        await expect.poll(()=>replacement.url,{timeout:30000}).toMatch(/^http:/);
        recoveredApi=replacement.url!;
        expect(await readLicense(recoveredApi)).toMatchObject({providerDeliveryStatus:'DELIVERED',activationKeyAvailable:true});
        expect((await handoff.readCustomerKey(customer.sub,issued.licenseId!)).secret).toBe(key.secret);
        expect((await providerPool.query('SELECT count(*)::int AS count FROM provider_receipts')).rows[0].count).toBe(2);
        expect((await pool.query('SELECT attempt_count FROM provider_license_deliveries WHERE id=$1',[pendingDelivery.id])).rows[0].attempt_count).toBe(2);
        expect((await pool.query('SELECT count(*)::int AS count FROM license_key_materials WHERE license_id=$1',[issued.licenseId])).rows[0].count).toBe(1);
        const receiptId=randomUUID();
        const response=await fetch(`${recoveredApi}/licenses/${issued.licenseId}/activation-key/retrieve`,{method:'POST',headers:{Authorization:'Bearer customer','Content-Type':'application/json'},body:JSON.stringify({deliveryId:receiptId})});
        expect(response.status).toBe(201);expect((await response.json()).activationKey).toBe(key.secret);
        const acknowledged=await fetch(`${recoveredApi}/licenses/${issued.licenseId}/activation-key/ack`,{method:'POST',headers:{Authorization:'Bearer customer','Content-Type':'application/json'},body:JSON.stringify({deliveryId:receiptId,keyVersion:1})});
        expect(acknowledged.ok).toBe(true);
      } catch(error) {throw new Error(`Handoff restart drill failed: ${String(error)}\n${diagnostics}`,{cause:error});}
      finally {for(const child of children)await stopChild(child);connection.disconnect();receiver.setFault(null);}
      const customerQueries=new LicenseQueryService(projections,envelopes,{} as never,30,new ActivationDeliveryRepository(pool,projections),handoff);
      const deliveryId=randomUUID();
      await expect(customerQueries.retrieveActivation(customer,issued.licenseId!,deliveryId)).rejects.toBeDefined();
      const verify=async(licenseKey:string,productId=command.payload.productId)=>(await fetch(`${origin}/verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseKey,productId})})).json();
      expect(await verify(key.secret)).toMatchObject({valid:true});
      expect(await verify('fabricated')).toMatchObject({valid:false});
      expect(await verify(key.secret,randomUUID())).toMatchObject({valid:false});
      expect((await providerPool.query('SELECT count(*)::int AS count FROM provider_receipts')).rows[0].count).toBe(2);
      expect((await pool.query('SELECT count(*)::int AS count FROM license_key_materials WHERE license_id=$1',[issued.licenseId])).rows[0].count).toBe(1);
      await expect(pool.query('UPDATE provider_license_deliveries SET provider_user_id=$1 WHERE license_id=$2',[customer.sub,issued.licenseId])).rejects.toMatchObject({code:'23503'});
      const savedSnapshot=(await pool.query('SELECT snapshot FROM provider_license_deliveries WHERE license_id=$1',[issued.licenseId])).rows[0].snapshot;
      expect(savedSnapshot).not.toHaveProperty('licenseKey');
      await expect(handoff.rejectProductUse(issued.licenseId!)).rejects.toMatchObject({response:{code:'LICENSE_USE_MANAGED_BY_PROVIDER'}});
      const confirm=async(commandId:string,eventType:ChainEventType)=>{
        const row=(await pool.query('SELECT * FROM chain_commands WHERE id=$1',[commandId])).rows[0];
        const transactionHash=`0x${randomBytes(32).toString('hex')}`,nextBlockHash=`0x${randomBytes(32).toString('hex')}`;
        const nextNonce=await commands.reserveNonce(row.id,relayer,0);
        await commands.markPrepared(row.id,{network:chain.network,nonce:nextNonce,relayerAddress:relayer,rawTransaction:'0x01',transactionHash});
        await commands.markSubmitted(row.id);
        const next=await events.ingest({blockHash:nextBlockHash,blockNumber:100+Number(row.license_command_sequence),chainCommandId:row.id,chainId:chain.chainId,confirmationCount:2,
          contractAddress:chain.contractAddress,eventType,licenseId:issued.licenseId!,logIndex:0,network:chain.network,payload:row.payload,providerUserId:providerId,transactionHash});
        await events.confirm(next.id,2,nextBlockHash);
        return next;
      };
      const licensing=new LicensingRepository(pool,handoff);
      const nextKey=`0x${randomBytes(32).toString('hex')}` as const;
      const rotation=await licensing.createRotationCommand(customer.sub,issued.licenseId!,activationCommitment(nextKey),2,chain,nextKey);
      await confirm(rotation.commandId,'KEY_ROTATED');
      await expect(handoff.readCustomerKey(customer.sub,issued.licenseId!)).rejects.toBeDefined();
      await handoff.runOne();
      expect((await handoff.readCustomerKey(customer.sub,issued.licenseId!)).secret).toBe(nextKey);
      expect(await verify(key.secret)).toMatchObject({valid:false});
      expect(await verify(nextKey)).toMatchObject({valid:true});
      const suspended=await licensing.createLifecycleCommand(providerId,issued.licenseId!,'SUSPEND_LICENSE',chain,'Test suspension');
      await confirm(suspended.commandId,'LICENSE_SUSPENDED');
      receiver.setFault('MALFORMED_RECEIPT');await handoff.runOne();
      expect((await repo.list(providerId))[0].status).toBe('FAILED');
      expect(await verify(nextKey)).toMatchObject({valid:false});
      receiver.setFault(null);
      const failed=(await repo.list(providerId))[0];
      expect(await repo.retry(String(failed.id),randomUUID(),'Wrong provider')).toBe(false);
      expect(await repo.retry(String(failed.id),providerId,'Retry receipt',providerId)).toBe(true);
      await handoff.runOne();
      const resumed=await licensing.createLifecycleCommand(providerId,issued.licenseId!,'RESUME_LICENSE',chain);
      const resumeEvent=await confirm(resumed.commandId,'LICENSE_RESUMED');await handoff.runOne();
      expect(await verify(nextKey)).toMatchObject({valid:true});
      await events.markReorged(resumeEvent.id);
      await expect(handoff.readCustomerKey(customer.sub,issued.licenseId!)).rejects.toBeDefined();
      await handoff.runOne();
      expect(await verify(nextKey)).toMatchObject({valid:false});
      const resumedRow=(await pool.query('SELECT * FROM chain_events WHERE id=$1',[resumeEvent.id])).rows[0];
      const restored=await events.ingest({blockHash:resumedRow.block_hash,blockNumber:Number(resumedRow.block_number),chainCommandId:resumed.commandId,
        chainId:chain.chainId,confirmationCount:2,contractAddress:chain.contractAddress,eventType:'LICENSE_RESUMED',licenseId:issued.licenseId!,
        logIndex:0,network:chain.network,payload:resumedRow.payload,providerUserId:providerId,transactionHash:resumedRow.transaction_hash});
      await events.confirm(restored.id,2,resumedRow.block_hash);
      await handoff.runOne();
      expect(await verify(nextKey)).toMatchObject({valid:true});
      const renewal=await commerce.createOrder(customer,randomUUID(),undefined,{planId:'00000000-0000-4000-8000-000000000301',targetLicenseId:issued.licenseId});
      const renewalTerms=await commerce.getServiceTerms(customer,renewal.id);
      await commerce.acceptServiceTerms(customer,renewal.id,{accepted:true,version:renewalTerms.version,hash:renewalTerms.hash});
      const renewalCheckout=await commerce.checkout(customer,renewal.id);
      const paidRenewal=await commerce.ingestIpn({amountVnd:renewal.priceVndSnapshot,eventId:randomUUID(),occurredAt:new Date().toISOString(),providerReference:renewalCheckout.checkoutReference},token);
      await confirm(paidRenewal.commandId!,'LICENSE_RENEWED');
      receiver.setFault('DROP_AFTER_COMMIT');await handoff.runOne();
      const expiryBeforeRetry=(await verify(nextKey)).expiresAt;
      await pool.query("UPDATE provider_license_deliveries SET next_attempt_at=now() WHERE license_id=$1 AND status='RETRY_WAIT'",[issued.licenseId]);
      receiver.setFault(null);await handoff.runOne();
      expect((await verify(nextKey)).expiresAt).toBe(expiryBeforeRetry);
      const revoked=await licensing.createLifecycleCommand(providerId,issued.licenseId!,'REVOKE_LICENSE',chain,'Test revocation');
      await confirm(revoked.commandId,'LICENSE_REVOKED');await handoff.runOne();
      expect(await verify(nextKey)).toMatchObject({valid:false});
      await repo.transaction((tx)=>handoff.publish(tx,issued.licenseId!,'TRUST_CHANGED'));
      const firstLease=await repo.claim();expect(firstLease).not.toBeNull();
      await pool.query("UPDATE provider_license_deliveries SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[firstLease!.id]);
      const nextLease=await repo.claim();expect(nextLease?.lease_token).not.toBe(firstLease!.lease_token);
      expect(await repo.complete(firstLease!,'stale-worker-receipt')).toBe(false);
      await repo.fail(nextLease!,'TEST_REQUEUE',0);
      const concurrent=await Promise.all([handoff.runOne(),handoff.runOne()]);
      expect(concurrent.filter(Boolean)).toHaveLength(1);
      await repo.transaction((tx)=>handoff.publish(tx,issued.licenseId!,'TRUST_CHANGED'));
      const supersededLease=await repo.claim();
      await repo.transaction((tx)=>handoff.publish(tx,issued.licenseId!,'TRUST_CHANGED'));
      expect(await repo.complete(supersededLease!,'outdated-revision-receipt')).toBe(false);
      expect((await pool.query('SELECT status FROM provider_license_deliveries WHERE id=$1',[supersededLease!.id])).rows[0].status).toBe('SUPERSEDED');
      const pending=(await repo.list(providerId))[0];
      await integration.save(providerId,{endpointUrl:`${origin}/receive`,configVersion:1,authorized:true});
      expect(await configs.verify(providerId,1)).toBe(false);
      await expect(integration.state(providerId,1,true)).rejects.toBeDefined();
      expect((await repo.list(providerId))[0]).toMatchObject({status:'FAILED',lastErrorCode:'PROVIDER_CONFIG_CHANGED'});
      expect(await repo.retry(String(pending.id),providerId,'Configuration change',providerId)).toBe(false);
      await integration.test(providerId);await integration.state(providerId,2,true);
      expect(await repo.retry(String(pending.id),providerId,'Configuration checked',providerId)).toBe(true);
      await handoff.runOne();
      expect((await pool.query('SELECT last_retry_reason,retried_by FROM provider_license_deliveries WHERE id=$1',[pending.id])).rows[0]).toMatchObject({last_retry_reason:'Configuration checked',retried_by:providerId});
      const staleDeliveryId=randomUUID();
      const staleResponse=await fetch(`${origin}/receive`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':staleDeliveryId},
        body:JSON.stringify({...savedSnapshot,deliveryId:staleDeliveryId,licenseKey:key.secret})});
      expect(staleResponse.status).toBe(409);
      expect(await staleResponse.json()).toMatchObject({code:'STALE_REVISION'});
      await repo.transaction((tx)=>handoff.publish(tx,issued.licenseId!,'TRUST_CHANGED'));
      const exhausted=await repo.claim();
      await pool.query("UPDATE provider_license_deliveries SET attempt_count=8,lease_expires_at=now()-interval '1 second' WHERE id=$1",[exhausted!.id]);
      expect(await repo.claim()).toBeNull();
      expect((await repo.list(providerId))[0]).toMatchObject({status:'FAILED',lastErrorCode:'PROVIDER_LEASE_EXHAUSTED'});
    } finally {await receiver.close();await providerPool.end();}
  },180000);
});

describe.runIf(Boolean(childFixture))('isolated handoff subprocess fixtures',()=>{
  async function childRuntime(){
    const database=new URL(process.env.EMUKEY_HANDOFF_FIXTURE_PG!);
    const redisUrl=new URL(process.env.EMUKEY_HANDOFF_FIXTURE_REDIS!);
    const origin=new URL(process.env.EMUKEY_HANDOFF_FIXTURE_ORIGIN!);
    if(!['127.0.0.1','localhost'].includes(database.hostname)||database.pathname!=='/emukey_provider_handoff_fixture'||
      !['127.0.0.1','localhost'].includes(redisUrl.hostname)||origin.hostname!=='127.0.0.1')throw new Error('Disposable local fixtures required');
    const pool=new Pool({connectionString:database.href});
    const redis=new Redis(redisUrl.href,{maxRetriesPerRequest:null});redis.on('error',()=>undefined);
    return{pool,redis,...handoffRuntime(pool,origin.origin)};
  }
  it.runIf(childFixture==='worker')('handoff worker child fixture',async()=>{
    const runtime=await childRuntime();
    const queue=new Queue(PROVIDER_DELIVERY_QUEUE,{connection:runtime.redis});
    const processor=new ProviderDeliveryProcessor(runtime.handoff);
    const worker=new Worker(PROVIDER_DELIVERY_QUEUE,()=>processor.process(),{connection:runtime.redis});
    worker.on('error',()=>undefined);
    const scheduler=new ProviderDeliveryScheduler(queue,runtime.redis);
    try{await worker.waitUntilReady();await scheduler.onModuleInit();await new Promise(resolve=>setTimeout(resolve,90000));}
    finally{scheduler.onModuleDestroy();await worker.close(true);await queue.close();runtime.redis.disconnect();await runtime.pool.end();}
  },100000);
  it.runIf(childFixture==='api')('handoff api child fixture',async()=>{
    const runtime=await childRuntime();
    const projection=new LicenseProjectionRepository(runtime.pool);
    const query=new LicenseQueryService(projection,{read:async()=>{throw new Error('Redis secret intentionally unavailable');},exists:async()=>false} as never,runtime.redis,30,new ActivationDeliveryRepository(runtime.pool,projection),runtime.handoff);
    const module=await Test.createTestingModule({controllers:[LicenseController,ProviderIntegrationController],providers:[
      {provide:LicenseQueryService,useValue:query},{provide:ProviderIntegrationService,useValue:runtime.integration},{provide:ProviderHandoffService,useValue:runtime.handoff},
      {provide:IdentityService,useValue:{authenticate:async(value:string)=>{
        if(!['customer','provider'].includes(value))throw new UnauthorizedException();
        return{role:value==='customer'?'CUSTOMER':'PROVIDER_ADMIN',sessionVersion:1,sub:value==='customer'?fixtureCustomer:fixtureProvider};
      }}},
    ]}).compile();
    const app=module.createNestApplication({logger:false});app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
    try{await app.listen(0,'127.0.0.1');console.log(`EMUKEY_HANDOFF_API:http://127.0.0.1:${app.getHttpServer().address().port}`);await new Promise(resolve=>setTimeout(resolve,90000));}
    finally{await app.close();runtime.redis.disconnect();await runtime.pool.end();}
  },100000);
});
