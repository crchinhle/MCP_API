import { CustomerControllerService } from './customer-controller.service.js';
import type { AuthPrincipal } from './identity.types.js';
export declare class CustomerControllerController {
    private readonly service;
    constructor(service: CustomerControllerService);
    get(actor: AuthPrincipal): Promise<import("./customer-controller.repository.js").CustomerControllerRecord>;
    provision(actor: AuthPrincipal): Promise<import("./customer-controller.repository.js").CustomerControllerRecord>;
}
