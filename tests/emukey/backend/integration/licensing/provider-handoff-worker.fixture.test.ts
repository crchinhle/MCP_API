import { Pool } from 'pg';
import { ProviderIntegrationService } from '../../../../../EmuKey/backend/src/modules/licensing/application/provider-integration.service.js';
import { ProviderHandoffService } from '../../../../../EmuKey/backend/src/modules/licensing/application/provider-handoff.service.js';
import { LicenseQueryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/license-query.service.js';
import { LicenseProjectionRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/license-projection.repository.js';
import { ActivationDeliveryRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/activation-delivery.repository.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { IdentityService } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import { ProviderIntegrationController } from '../../../../../EmuKey/backend/src/modules/licensing/presentation/provider-integration.controller.js';
import { Redis } from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { ProviderDeliveryScheduler } from '../../../../../EmuKey/backend/src/modules/licensing/worker/provider-delivery.scheduler.js';
import { ProviderDeliveryProcessor, PROVIDER_DELIVERY_QUEUE } from '../../../../../EmuKey/backend/src/modules/licensing/worker/provider-delivery.processor.js';
import { LicenseController } from '../../../../../EmuKey/backend/src/modules/blockchain/presentation/license.controller.js';
import { handoffRuntime, fixtureProvider, fixtureCustomer } from './provider-handoff-runtime.fixture.js';

const childFixture = process.env.EMUKEY_HANDOFF_CHILD;

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
    try{await worker.waitUntilReady();await scheduler.onModuleInit();console.log('EMUKEY_HANDOFF_WORKER_READY');await new Promise(resolve=>setTimeout(resolve,90000));}
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
