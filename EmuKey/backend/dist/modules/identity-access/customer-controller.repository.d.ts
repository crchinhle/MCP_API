import { Pool } from 'pg';
import type { ControllerKeyIdentity } from './application/ports/controller-kms.port.js';
export interface CustomerControllerRecord extends ControllerKeyIdentity {
    customerUserId: string;
    id: string;
    status: 'ACTIVE' | 'RECOVERY_REQUIRED' | 'ROTATING';
}
export declare class CustomerControllerRepository {
    private readonly pool;
    constructor(pool: Pool);
    findByCustomer(customerUserId: string): Promise<CustomerControllerRecord | null>;
    createIdempotent(customerUserId: string, identity: ControllerKeyIdentity): Promise<CustomerControllerRecord>;
}
