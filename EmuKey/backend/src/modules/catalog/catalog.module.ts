import { Module } from '@nestjs/common';
import { Pool } from 'pg';

import { CatalogController } from './presentation/catalog.controller.js';
import { CatalogRepository } from './infrastructure/catalog.repository.js';
import { CatalogService } from './application/catalog.service.js';
import { CatalogAdminService } from './application/catalog-admin.service.js';
import { CatalogAdminRepository } from './infrastructure/catalog-admin.repository.js';
import { PlanController } from './presentation/plan.controller.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import { ComparePlansQuery } from './application/compare-plans.query.js';

@Module({
  imports: [IdentityModule],
  controllers: [CatalogController, PlanController],
  providers: [
    { provide: CatalogRepository, inject: [Pool], useFactory: (pool: Pool) => new CatalogRepository(pool) },
    { provide: CatalogService, inject: [CatalogRepository], useFactory: (repo: CatalogRepository) => new CatalogService(repo) },
    { provide: ComparePlansQuery, inject: [CatalogRepository], useFactory: (repo: CatalogRepository) => new ComparePlansQuery(repo) },
    { provide: CatalogAdminRepository, inject: [Pool, AuditWriter], useFactory: (pool: Pool, audit: AuditWriter) => new CatalogAdminRepository(pool, audit) },
    { provide: CatalogAdminService, inject: [CatalogAdminRepository], useFactory: (repo: CatalogAdminRepository) => new CatalogAdminService(repo) },
  ],
})
export class CatalogModule {}
