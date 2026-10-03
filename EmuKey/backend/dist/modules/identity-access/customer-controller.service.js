var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable } from '@nestjs/common';
let CustomerControllerService = class CustomerControllerService {
    repository;
    kms;
    constructor(repository, kms) {
        this.repository = repository;
        this.kms = kms;
    }
    async provision(customerUserId) {
        const existing = await this.repository.findByCustomer(customerUserId);
        if (existing)
            return existing;
        // KMS is deliberately outside the database transaction. Its idempotency key is
        // the immutable Customer ID; persistence then converges concurrent calls.
        const identity = await this.kms.provision(customerUserId);
        return this.repository.createIdempotent(customerUserId, identity);
    }
    async requireActive(customerUserId) {
        const controller = await this.provision(customerUserId);
        if (controller.status !== 'ACTIVE') {
            throw new ConflictException({
                code: 'CONTROLLER_RECOVERY_REQUIRED',
                message: 'Customer Controller is not active.',
            });
        }
        return controller;
    }
};
CustomerControllerService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [Object, Object])
], CustomerControllerService);
export { CustomerControllerService };
//# sourceMappingURL=customer-controller.service.js.map