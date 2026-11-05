import { applyUpgrade, canonicalCatalogSql, upgradeSection } from '../../../../../EmuKey/backend/src/platform/database/database-cli.js';
import { createHash } from 'node:crypto';

describe('explicit schema upgrade sections', () => {
  it('refuses a standalone legacy bridge before touching the database', async () => {
    const database={query:vi.fn()};
    await expect(applyUpgrade(database as never,'','9ed5729','cf17043')).rejects.toThrow('Use the complete legacy-to-handoff upgrade');
    expect(database.query).not.toHaveBeenCalled();
  });
  it('compares only equivalent literal varchar-array casts without masking value or operator drift', () => {
    const fresh="CHECK (status = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying])::text[]))";
    const restored="CHECK (status = ANY (ARRAY[('ACTIVE'::character varying)::text, ('SUSPENDED'::character varying)::text]))";
    expect(canonicalCatalogSql(fresh)).toBe(canonicalCatalogSql(restored));
    expect(canonicalCatalogSql(fresh)).toBe(canonicalCatalogSql("CHECK (status = ANY (ARRAY['ACTIVE'::character varying::text, 'SUSPENDED'::character varying::text]))"));
    expect(canonicalCatalogSql(fresh)).not.toBe(canonicalCatalogSql(restored.replace('ACTIVE','REVOKED')));
    expect(canonicalCatalogSql(fresh)).not.toBe(canonicalCatalogSql(restored.replace('= ANY','<> ALL')));
    expect(canonicalCatalogSql("ARRAY[status::character varying]::text[]")).toBe("ARRAY[status::character varying]::text[]");
  });
  it('accepts a second independently approved source fingerprint without disabling drift checks', async () => {
    const fingerprint=createHash('sha256').update('').digest('hex');
    const database={query:vi.fn(async(statement:string)=>({rows:statement.includes('to_regclass')?[{name:null}]:[]}))};
    const route=`-- emukey:legacy-fingerprint:base:${'0'.repeat(64)}\n-- emukey:legacy-fingerprint:base:${fingerprint}\n/* emukey:upgrade:base:target:begin\nSELECT 1;\nemukey:upgrade:end */`;
    await expect(applyUpgrade(database as never,route,'base','target')).resolves.toBe('APPLIED');
    await expect(applyUpgrade(database as never,route.replaceAll('\n','\r\n'),'base','target')).resolves.toBe('APPLIED');
    await expect(applyUpgrade(database as never,route.replace(fingerprint,'1'.repeat(64)),'base','target')).rejects.toThrow('fingerprint');
  });
  it('composes the supported pre-continuity route without executing the fresh initializer', () => {
    const route = [['9ed5729','cf17043'],['cf17043','continuity_20261101'],['continuity_20261101','provider_handoff_20261104']]
      .map(([from,to],i)=>`/* emukey:upgrade:${from}:${to}:begin\nSELECT ${i};\nemukey:upgrade:end */`).join('\n');
    expect(upgradeSection(`DROP SCHEMA public CASCADE;\n${route}`,'9ed5729','provider_handoff_20261104')).toBe('SELECT 0;\nSELECT 1;\nSELECT 2;');
  });
  const sql = 'BEGIN; DROP SCHEMA public CASCADE;\n/* emukey:upgrade:base:target:begin\nALTER TABLE users ADD COLUMN nickname text;\nemukey:upgrade:end */\nCOMMIT;';
  it('extracts only the approved delta and never the destructive fresh schema', () => {
    const delta = upgradeSection(sql, 'base', 'target');
    expect(delta).toContain('ALTER TABLE users');
    expect(delta).not.toContain('DROP SCHEMA');
    expect(upgradeSection(sql.replaceAll('\n', '\r\n'), 'base', 'target')).toBe(delta);
  });
  it('rejects unknown, ambiguous and destructive sections', () => {
    expect(() => upgradeSection(sql, 'other', 'target')).toThrow();
    expect(() => upgradeSection(sql + sql, 'base', 'target')).toThrow();
    expect(() => upgradeSection(sql.replace('ALTER TABLE users ADD COLUMN nickname text;', 'DROP SCHEMA public CASCADE;'), 'base', 'target')).toThrow();
  });
});
