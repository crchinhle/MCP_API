import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { Wait } from 'testcontainers';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyUpgrade, canonicalCatalogSql, schemaDefinitions, schemaFingerprint, upgradeSection } from '../../../../../EmuKey/backend/src/platform/database/database-cli.js';

describe('data-preserving continuity schema upgrade', () => {
  let container: StartedPostgreSqlContainer;
  let database: Client;
  beforeAll(async () => {
    // Reserve a second port for the restored physical clone. Only the original
    // server participates in startup health; the clone starts after backup.
    container = await new PostgreSqlContainer('postgres:15-alpine').withExposedPorts(5433).withWaitStrategy(Wait.forHealthCheck()).start();
    database = new Client({ connectionString: container.getConnectionUri() });
    await database.connect();
  }, 120_000);
  afterAll(async () => { if (database) await database.end(); if (container) await container.stop(); });

  it('upgrades the deployed 9ed5729 PostgreSQL 18 baseline without losing business rows or resending old email', async () => {
    const legacyContainer=await new PostgreSqlContainer('postgres:18-alpine').start();
    const db=new Client({connectionString:legacyContainer.getConnectionUri()});
    const workspace=resolve(import.meta.dirname,'../../../../..');
    try {
      await db.connect();
      const git=promisify(execFile);
      const source=(await git('git',['show','9ed5729:EmuKey/backend/database/schema.sql'],{cwd:workspace,maxBuffer:2000000})).stdout;
      await db.query(source);
      const fingerprint=await schemaFingerprint(db);
      const seedSource=(await git('git',['show','9ed5729:tooling/emukey/fixtures/seed-demo-data.mjs'],{cwd:workspace,maxBuffer:2000000})).stdout
        .replace('"../../../EmuKey/backend/package.json"',JSON.stringify(pathToFileURL(resolve(workspace,'EmuKey/backend/package.json')).href))
        .replace('await run();','export { SEED_SQL, PRODUCT_CATALOG, ACTIVATION_FIXTURES };');
      const seed=await import(`data:text/javascript;base64,${Buffer.from(seedSource).toString('base64')}`);
      await db.query("SELECT set_config('emukey.seed_namespace','emukey-root-demo-v1',false),set_config('emukey.seed_password_hash','legacy-test-hash',false),set_config('emukey.seed_activations',$1,false),set_config('emukey.seed_products',$2,false)",[JSON.stringify(seed.ACTIVATION_FIXTURES),JSON.stringify(seed.PRODUCT_CATALOG)]);
      await db.query(seed.SEED_SQL);
      await db.query(`INSERT INTO notifications(user_id,event_key,type,title,content,channel,delivery_status,attempt_count,sent_at,next_attempt_at,last_error)
        SELECT id,'migration-email-sent','TEST','Sent','Keep receipt','EMAIL','SENT',2,now(),NULL,NULL FROM users WHERE role='CUSTOMER' LIMIT 1`);
      await db.query(`INSERT INTO notifications(user_id,event_key,type,title,content,channel,delivery_status,attempt_count,next_attempt_at,last_error)
        SELECT id,'migration-email-retry','TEST','Retry','Keep retry','EMAIL','RETRYABLE_FAILED',3,now()+interval '1 day','SAFE_TEST_ERROR' FROM users WHERE role='CUSTOMER' LIMIT 1`);
      const omitted:Record<string,string[]>={provider_invitations:['display_name','organization_name'],plans:['provider_user_id','provider_role','billing_cycle'],orders:['billing_cycle_snapshot'],chain_commands:['lease_owner','lease_expires_at'],knowledge_documents:['provider_user_id'],conversations:['context_type','context_id'],messages:['read_at'],notifications:['data','read_at','channel','delivery_status','attempt_count','next_attempt_at','lease_owner','lease_expires_at','last_error','is_read','sent_at']};
      const columns=(await db.query<{table_name:string;column_name:string}>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
      const capture=async()=>{
        const snapshots:Record<string,string[]>={};
        for(const table of [...new Set(columns.map(c=>c.table_name))]){
          const names=columns.filter(c=>c.table_name===table&&!omitted[table]?.includes(c.column_name)).map(c=>c.column_name);
          if([table,...names].some(name=>!/^[a-z_][a-z0-9_]*$/.test(name)))throw new Error('Unexpected fixture identifier');
          snapshots[table]=(await db.query<{value:string}>(`SELECT to_jsonb(r)::text AS value FROM (SELECT ${names.map(n=>`"${n}"`).join(',')} FROM "${table}") r ORDER BY to_jsonb(r)::text`)).rows.map(r=>r.value);
        }
        return snapshots;
      };
      const before=await capture();
      const context=(await db.query('SELECT id,context_type,context_id FROM conversations ORDER BY id')).rows;
      const emails=(await db.query("SELECT id,delivery_status,attempt_count,sent_at,last_error FROM notifications WHERE channel='EMAIL' ORDER BY id")).rows;
      const notices=(await db.query('SELECT id,data,is_read,read_at FROM notifications ORDER BY id')).rows;
      const sql=await readFile(resolve(workspace,'EmuKey/backend/database/schema.sql'),'utf8');
      expect(sql).toContain(`-- emukey:legacy-fingerprint:9ed5729:${fingerprint}`);
      await db.query("INSERT INTO provider_invitations(email,display_name,token_hash,invited_by_user_id,expires_at) SELECT 'legacy-invite@migration.test','Retain historical invite name',decode(repeat('ab',32),'hex'),id,now()+interval '1 day' FROM users WHERE role='SYSTEM_ADMIN' LIMIT 1");
      await expect(applyUpgrade(db,sql,'9ed5729','provider_handoff_20261104')).rejects.toThrow('LEGACY_DATA_REQUIRES_EXPLICIT_ARCHIVAL');
      expect((await db.query("SELECT count(*)::int AS count FROM provider_invitations WHERE display_name='Retain historical invite name'")).rows[0].count).toBe(1);
      await db.query('UPDATE provider_invitations SET display_name=NULL');
      before.provider_invitations=(await capture()).provider_invitations;
      const backup=await legacyContainer.exec(['pg_dump','-U',legacyContainer.getUsername(),'-d',legacyContainer.getDatabase(),'--format=custom','--file=/tmp/pre-handoff.dump']);
      expect(backup.exitCode,backup.output).toBe(0);
      const delta=upgradeSection(sql,'9ed5729','provider_handoff_20261104');
      const failBeforeCommit={query:async(statement:string,values?:unknown[])=>{const result=await db.query(statement,values);if(statement===delta)throw new Error('Injected legacy upgrade commit failure');return result;}} as unknown as Client;
      await expect(applyUpgrade(failBeforeCommit,sql,'9ed5729','provider_handoff_20261104')).rejects.toThrow('Injected legacy upgrade commit failure');
      expect(await schemaFingerprint(db)).toBe(fingerprint);
      expect(await capture()).toEqual(before);
      await expect(applyUpgrade(db,sql,'9ed5729','provider_handoff_20261104')).resolves.toBe('APPLIED');
      expect(await capture()).toEqual(before);
      for(const row of notices){
        const item=(await db.query('SELECT data,read_at FROM notifications WHERE id=$1',[row.id])).rows[0];
        expect(item.data._emukey_legacy_delivery.isRead).toBe(row.is_read);
        expect(item.data._emukey_legacy_delivery.readAt).toBe(row.read_at);
        delete item.data._emukey_legacy_delivery;
        expect(item.data).toEqual(row.data);
        if(row.is_read)expect(item.read_at).not.toBeNull();
      }
      expect((await db.query("SELECT notification_id AS id,delivery_status,attempt_count,sent_at,last_error FROM notification_deliveries WHERE channel='EMAIL' ORDER BY notification_id")).rows).toEqual(emails);
      for(const row of context){
        const item=(await db.query('SELECT product_id,plan_id,order_id,license_id FROM conversations WHERE id=$1',[row.id])).rows[0];
        expect(Object.values(item).filter(Boolean)).toEqual(row.context_type==='GENERAL'?[]:[row.context_id]);
      }
      expect((await db.query('SELECT token_count FROM knowledge_chunks WHERE token_count IS NOT NULL')).rows).toHaveLength(30);
      expect((await db.query("SELECT count(*)::int AS count FROM orders WHERE fulfillment_mode='LEGACY_DEVICE'")).rows[0].count).toBe(30);
      await expect(applyUpgrade(db,sql,'9ed5729','provider_handoff_20261104')).resolves.toBe('CURRENT');
      const upgraded=await schemaDefinitions(db);
      await db.query(sql);
      const fresh=await schemaDefinitions(db);
      expect({onlyFresh:fresh.filter(d=>!upgraded.includes(d)),onlyUpgraded:upgraded.filter(d=>!fresh.includes(d))}).toEqual({onlyFresh:[],onlyUpgraded:[]});
      expect((await legacyContainer.exec(['createdb','-U',legacyContainer.getUsername(),'logical_pre_handoff'])).exitCode).toBe(0);
      const restored=await legacyContainer.exec(['pg_restore','-U',legacyContainer.getUsername(),'-d','logical_pre_handoff','--exit-on-error','/tmp/pre-handoff.dump']);
      expect(restored.exitCode,restored.output).toBe(0);
      const restoredUrl=new URL(legacyContainer.getConnectionUri());restoredUrl.pathname='/logical_pre_handoff';
      const restoredDb=new Client({connectionString:restoredUrl.href});await restoredDb.connect();
      try{
        expect(sql).toContain(`-- emukey:legacy-fingerprint:9ed5729:${await schemaFingerprint(restoredDb)}`);
        await expect(applyUpgrade(restoredDb,sql,'9ed5729','provider_handoff_20261104')).resolves.toBe('APPLIED');
        const restoredDefinitions=(await schemaDefinitions(restoredDb)).map(canonicalCatalogSql).sort();
        const canonicalFresh=fresh.map(canonicalCatalogSql).sort();
        expect({onlyFresh:canonicalFresh.filter(d=>!restoredDefinitions.includes(d)),onlyRestored:restoredDefinitions.filter(d=>!canonicalFresh.includes(d))}).toEqual({onlyFresh:[],onlyRestored:[]});
      }finally{await restoredDb.end();}
    } finally {await db.end();await legacyContainer.stop();}
  },120000);

  it('retains rows, converges with a fresh schema and refuses unknown schema drift', async () => {
    const workspace = resolve(import.meta.dirname, '../../../../..');
    const baseline = await promisify(execFile)('git', ['show', 'cf17043:EmuKey/backend/database/schema.sql'], { cwd: workspace, maxBuffer: 2 * 1024 * 1024 });
    await database.query(baseline.stdout.replace('BEGIN;', "BEGIN; SET LOCAL emukey.seed_demo='true'; SET LOCAL emukey.seed_environment='development';"));
    const fingerprint = await schemaFingerprint(database);
    const sql = await readFile(resolve(workspace, 'EmuKey/backend/database/schema.sql'), 'utf8');
    expect(sql).toContain(`-- emukey:legacy-fingerprint:cf17043:${fingerprint}`);
    const approved = sql;
    await database.query("INSERT INTO users(email,password_hash,display_name,role,status,customer_type,email_verified_at) VALUES ('upgrade@example.test','hash','Retained','CUSTOMER','ACTIVE','INDIVIDUAL',now())");
    const before = await database.query('SELECT id,email FROM users ORDER BY id');
    const columns = (await database.query<{ table_name: string; names: string[] }>(`SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) AS names
      FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name`)).rows;
    const capture = async (connection: Client) => {
      const snapshots: Record<string, { count: number; hash: string }> = {};
      for (const table of columns) {
        const identifiers = [table.table_name, ...table.names];
        if (identifiers.some((identifier) => !/^[a-z_][a-z0-9_]*$/.test(identifier))) throw new Error('Unexpected baseline identifier');
        const rows = (await connection.query<{ value: string }>(`SELECT to_jsonb(snapshot_row)::text AS value
          FROM (SELECT ${table.names.map((name) => `"${name}"`).join(',')} FROM "${table.table_name}") snapshot_row
          ORDER BY to_jsonb(snapshot_row)::text`)).rows;
        snapshots[table.table_name] = { count: rows.length, hash: createHash('sha256').update(rows.map((row) => row.value).join('\n')).digest('hex') };
      }
      return snapshots;
    };
    const businessBefore = await capture(database);
    for (const table of ['orders', 'payment_transactions', 'licenses', 'chain_commands']) expect(businessBefore[table].count, table).toBeGreaterThan(0);
    const physical = await container.exec(['pg_basebackup', '-h', '127.0.0.1', '-U', container.getUsername(), '-D', '/tmp/emukey-physical-restore', '--wal-method=stream', '--checkpoint=fast'],
      { user: 'postgres', env: { PGPASSWORD: container.getPassword() } });
    expect(physical.exitCode, physical.output).toBe(0);
    const backup = await container.exec(['pg_dump', '-U', container.getUsername(), '-d', container.getDatabase(), '--format=custom', '--file=/tmp/emukey-before-upgrade.dump']);
    expect(backup.exitCode, backup.output).toBe(0);
    const delta = upgradeSection(approved, 'cf17043', 'continuity_20261101');
    // Run the real DDL, then lose the caller before version metadata/COMMIT.
    const failingConnection = { query: async (statement: string, values?: unknown[]) => {
      const result = await database.query(statement, values);
      if (statement === delta) throw new Error('Injected failure before upgrade commit');
      return result;
    } } as unknown as Client;
    await expect(applyUpgrade(failingConnection, approved, 'cf17043', 'continuity_20261101')).rejects.toThrow('Injected failure');
    expect(await schemaFingerprint(database)).toBe(fingerprint);
    expect((await database.query('SELECT id,email FROM users ORDER BY id')).rows).toEqual(before.rows);
    expect(await capture(database)).toEqual(businessBefore);
    expect((await database.query("SELECT to_regclass('public.schema_versions') AS name, to_regclass('public.license_key_deliveries') AS receipt")).rows[0]).toEqual({ name: null, receipt: null });
    await expect(applyUpgrade(database, approved, 'cf17043', 'continuity_20261101')).resolves.toBe('APPLIED');
    expect((await database.query('SELECT id,email FROM users ORDER BY id')).rows).toEqual(before.rows);
    expect(await capture(database)).toEqual(businessBefore);
    await expect(applyUpgrade(database, approved, 'cf17043', 'continuity_20261101')).resolves.toBe('CURRENT');
    const upgraded = await schemaFingerprint(database);
    const upgradedDefinitions = await schemaDefinitions(database);
    // Restore into an empty clone: --clean alone would leave objects absent
    // from the old backup, including the new schema_versions/receipt tables.
    const created = await container.exec(['createdb', '-U', container.getUsername(), 'emukey_restore_fixture']);
    expect(created.exitCode, created.output).toBe(0);
    const restored = await container.exec(['pg_restore', '-U', container.getUsername(), '-d', 'emukey_restore_fixture', '--exit-on-error', '/tmp/emukey-before-upgrade.dump']);
    expect(restored.exitCode, restored.output).toBe(0);
    const clone = new Client({ connectionString: container.getConnectionUri().replace(/\/[^/?]+(?=\?|$)/, '/emukey_restore_fixture') });
    await clone.connect();
    try {
      // PostgreSQL's logical round-trip rewrites some varchar/text casts.
      // Rows survive, but an unapproved structural form must still be refused.
      expect((await clone.query('SELECT id,email FROM users ORDER BY id')).rows).toEqual(before.rows);
      expect(await capture(clone)).toEqual(businessBefore);
      await expect(applyUpgrade(clone, approved, 'cf17043', 'continuity_20261101')).rejects.toThrow('fingerprint');
    } finally { await clone.end(); }
    const started = await container.exec(['pg_ctl', '-D', '/tmp/emukey-physical-restore', '-l', '/tmp/emukey-physical-restore.log', '-o', '-p 5433 -h 0.0.0.0 -k /tmp', '-w', 'start'], { user: 'postgres' });
    expect(started.exitCode, started.output).toBe(0);
    const cloneUrl = new URL(container.getConnectionUri());
    cloneUrl.port = String(container.getMappedPort(5433));
    const physicalClone = new Client({ connectionString: cloneUrl.toString() });
    await physicalClone.connect();
    try {
      expect(await schemaFingerprint(physicalClone)).toBe(fingerprint);
      expect((await physicalClone.query('SELECT id,email FROM users ORDER BY id')).rows).toEqual(before.rows);
      expect(await capture(physicalClone)).toEqual(businessBefore);
      await expect(applyUpgrade(physicalClone, approved, 'cf17043', 'continuity_20261101')).resolves.toBe('APPLIED');
      expect(await schemaFingerprint(physicalClone)).toBe(upgraded);
      expect(await capture(physicalClone)).toEqual(businessBefore);
      await expect(applyUpgrade(physicalClone, approved, 'cf17043', 'continuity_20261101')).resolves.toBe('CURRENT');
    } finally {
      await physicalClone.end();
      const stopped = await container.exec(['pg_ctl', '-D', '/tmp/emukey-physical-restore', '-m', 'fast', '-w', 'stop'], { user: 'postgres' });
      expect(stopped.exitCode, stopped.output).toBe(0);
    }
    await database.query('ALTER TABLE users ADD COLUMN unexpected_after_upgrade text');
    await expect(applyUpgrade(database, approved, 'cf17043', 'continuity_20261101')).rejects.toThrow('fingerprint');
    await database.query('ALTER TABLE users DROP COLUMN unexpected_after_upgrade');
    await database.query(sql.replace(/-- emukey:handoff-ddl:begin[\s\S]*?-- emukey:handoff-ddl:end/,''));
    const freshDefinitions = await schemaDefinitions(database);
    expect(freshDefinitions.filter((definition) => !upgradedDefinitions.includes(definition))).toEqual([]);
    expect(upgradedDefinitions.filter((definition) => !freshDefinitions.includes(definition))).toEqual([]);
    expect(await schemaFingerprint(database)).toBe(upgraded);
    await database.query(baseline.stdout);
    await database.query('ALTER TABLE users ADD COLUMN unexpected text');
    await expect(applyUpgrade(database, approved, 'cf17043', 'continuity_20261101')).rejects.toThrow('fingerprint');
    expect((await database.query("SELECT to_regclass('public.schema_versions') AS name")).rows[0].name).toBeNull();
  }, 120_000);
});
