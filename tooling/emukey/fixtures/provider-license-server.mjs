import { createServer } from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const hash = (value) => createHash('sha256').update(value).digest('hex');

/** Independent receiver fixture. Its pool MUST point to a separate test database. */
export async function createProviderLicenseServer({ pool, token, providerId, port = 0 }) {
  if (!token || !providerId) throw new Error('Provider test identity and token are required');
  await pool.query(`CREATE TABLE IF NOT EXISTS provider_licenses (
    license_id UUID PRIMARY KEY,product_id UUID NOT NULL,key_hash TEXT NOT NULL,
    revision BIGINT NOT NULL,snapshot JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS provider_receipts (
      delivery_id UUID PRIMARY KEY,payload_hash TEXT NOT NULL,receipt JSONB NOT NULL)`);
  let fault = null;
  const server = createServer(async (req, res) => {
    const reply = (status, body) => { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body)); };
    try {
      if (req.method !== 'POST' || !['/receive','/verify'].includes(req.url)) return reply(404,{code:'NOT_FOUND'});
      let text = '';
      for await (const chunk of req) {text+=chunk.toString();if(Buffer.byteLength(text)>131072) return reply(413,{code:'BODY_TOO_LARGE'});}
      const body = JSON.parse(text);
      if (req.url==='/verify') {
        if (typeof body.licenseKey!=='string' || typeof body.productId!=='string') return reply(200,{valid:false});
        const result = await pool.query(`SELECT snapshot FROM provider_licenses WHERE key_hash=$1 AND product_id::text=$2`,[hash(body.licenseKey.trim()),body.productId]);
        const license=result.rows[0]?.snapshot;
        return reply(200,{valid:!!license && license.usable===true && license.status==='ACTIVE' && Date.parse(license.expiresAt)>Date.now(),
          ...(license ? {expiresAt:license.expiresAt,rights:license.plan.entitlements}: {})});
      }
      if (hash(req.headers.authorization ?? '')!==hash(`Bearer ${token}`) ||
        !timingSafeEqual(Buffer.from(hash(req.headers.authorization ?? '')),Buffer.from(hash(`Bearer ${token}`)))) return reply(401,{code:'UNAUTHORIZED'});
      if (body.providerId!==providerId || body.schemaVersion!==1) return reply(422,{code:'WRONG_PROVIDER'});
      if (body.type==='CONNECTION_TEST') return reply(200,{schemaVersion:1,type:'CONNECTION_TEST_ACK',providerId,nonce:body.nonce});
      if (!Number.isSafeInteger(body.revision) || body.revision<1 || typeof body.licenseKey!=='string' ||
        req.headers['idempotency-key']!==body.deliveryId || !body.plan || !Number.isFinite(Date.parse(body.expiresAt))) return reply(422,{code:'INVALID_SNAPSHOT'});
      const digest=hash(JSON.stringify(body));
      const client=await pool.connect();
      let receipt;
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[body.licenseId]);
        const previous=(await client.query('SELECT * FROM provider_receipts WHERE delivery_id=$1',[body.deliveryId])).rows[0];
        if (previous) {
          if (previous.payload_hash!==digest) {await client.query('ROLLBACK');return reply(409,{code:'DELIVERY_CONFLICT'});}
          receipt=previous.receipt;
        } else {
          const current=(await client.query('SELECT revision FROM provider_licenses WHERE license_id=$1',[body.licenseId])).rows[0];
          if (current && Number(current.revision)>=body.revision) {await client.query('ROLLBACK');return reply(409,{code:'STALE_REVISION'});}
          const {licenseKey,...snapshot}=body;
          await client.query(`INSERT INTO provider_licenses(license_id,product_id,key_hash,revision,snapshot) VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (license_id) DO UPDATE SET key_hash=excluded.key_hash,revision=excluded.revision,snapshot=excluded.snapshot`,
          [body.licenseId,body.productId,hash(licenseKey),body.revision,JSON.stringify(snapshot)]);
          receipt={deliveryId:body.deliveryId,licenseId:body.licenseId,revision:body.revision,receiptId:randomUUID(),result:'ACCEPTED'};
          await client.query('INSERT INTO provider_receipts(delivery_id,payload_hash,receipt) VALUES ($1,$2,$3)',[body.deliveryId,digest,JSON.stringify(receipt)]);
        }
        await client.query('COMMIT');
      } catch {await client.query('ROLLBACK');return reply(422,{code:'RECEIVER_REJECTED'});}
      finally {client.release();}
      if (fault==='DROP_AFTER_COMMIT') {req.socket.destroy();return;}
      if (fault==='HOLD_AFTER_COMMIT') return;
      if (fault==='MALFORMED_RECEIPT') return reply(200,{ok:true});
      reply(200,receipt);
    } catch {reply(400,{code:'INVALID_REQUEST'});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin:`http://127.0.0.1:${server.address().port}`,setFault:(value)=>{fault=value;},
    close:()=>new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()))};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV==='production') throw new Error('Test receiver cannot run in production');
  const require=createRequire(new URL('../../../EmuKey/backend/package.json',import.meta.url));
  const {Pool}=require('pg');
  if (!process.env.PROVIDER_DATABASE_URL) throw new Error('Use a separate PROVIDER_DATABASE_URL test database');
  const pool=new Pool({connectionString:process.env.PROVIDER_DATABASE_URL});
  const fixture=await createProviderLicenseServer({pool,token:process.env.PROVIDER_RECEIVER_TOKEN,providerId:process.env.PROVIDER_RECEIVER_ID,port:Number(process.env.PROVIDER_RECEIVER_PORT ?? 4123)});
  process.stdout.write(`Provider fixture listening at ${fixture.origin}\n`);
  const stop=async()=>{await fixture.close();await pool.end();};
  process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
}
