import type { ControllerKmsPort } from './application/ports/controller-kms.port.js';
import type { CustomerControllerRecord } from './customer-controller.repository.js';
export interface ControllerStore {
    createIdempotent(customerUserId: string, identity: Awaited<ReturnType<ControllerKmsPort['provision']>>): Promise<CustomerControllerRecord>;
    findByCustomer(customerUserId: string): Promise<CustomerControllerRecord | null>;
}
export declare class CustomerControllerService {
    private readonly repository;
    private readonly kms;
    constructor(repository: ControllerStore, kms: ControllerKmsPort);
    provision(customerUserId: string): Promise<CustomerControllerRecord>;
    requireActive(customerUserId: string): Promise<CustomerControllerRecord>;
}
