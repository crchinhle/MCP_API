var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let CatalogModule = class CatalogModule {
};
CatalogModule = __decorate([
    Module({
        imports: [IdentityModule],
        controllers: [CatalogController, PlanController],
        providers: [
            { provide: CatalogRepository, inject: [Pool], useFactory: (pool) => new CatalogRepository(pool) },
            { provide: CatalogService, inject: [CatalogRepository], useFactory: (repo) => new CatalogService(repo) },
            { provide: ComparePlansQuery, inject: [CatalogRepository], useFactory: (repo) => new ComparePlansQuery(repo) },
            { provide: CatalogAdminRepository, inject: [Pool, AuditWriter], useFactory: (pool, audit) => new CatalogAdminRepository(pool, audit) },
            { provide: CatalogAdminService, inject: [CatalogAdminRepository], useFactory: (repo) => new CatalogAdminService(repo) },
        ],
    })
], CatalogModule);
export { CatalogModule };
//# sourceMappingURL=catalog.module.js.map