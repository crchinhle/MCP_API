import { canonicalCatalogSql, readDatabaseSql } from '../../../../../EmuKey/backend/src/platform/database/database-cli.js';

describe('fresh database initialization', () => {
  it('compares only equivalent literal varchar-array casts without masking value or operator drift', () => {
    const fresh="CHECK (status = ANY ((ARRAY['ACTIVE'::character varying, 'SUSPENDED'::character varying])::text[]))";
    const restored="CHECK (status = ANY (ARRAY[('ACTIVE'::character varying)::text, ('SUSPENDED'::character varying)::text]))";
    expect(canonicalCatalogSql(fresh)).toBe(canonicalCatalogSql(restored));
    expect(canonicalCatalogSql(fresh)).toBe(canonicalCatalogSql("CHECK (status = ANY (ARRAY['ACTIVE'::character varying::text, 'SUSPENDED'::character varying::text]))"));
    expect(canonicalCatalogSql(fresh)).not.toBe(canonicalCatalogSql(restored.replace('ACTIVE','REVOKED')));
    expect(canonicalCatalogSql(fresh)).not.toBe(canonicalCatalogSql(restored.replace('= ANY','<> ALL')));
    expect(canonicalCatalogSql("ARRAY[status::character varying]::text[]")).toBe("ARRAY[status::character varying]::text[]");
  });
  it('creates the current schema without version bookkeeping or upgrade sections', async () => {
    const sql = await readDatabaseSql();
    expect(sql).not.toContain('schema_versions');
    expect(sql).not.toContain('emukey:upgrade:');
    expect(sql.match(/CREATE TABLE /g)).toHaveLength(23);
    expect(sql).toContain('DROP SCHEMA IF EXISTS public CASCADE');
  });
});
