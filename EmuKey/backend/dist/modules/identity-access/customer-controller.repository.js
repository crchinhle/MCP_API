function mapController(row) {
    return {
        customerUserId: String(row.customer_user_id),
        id: String(row.id),
        keyReference: String(row.key_reference),
        keyVersion: Number(row.key_version),
        publicAddress: String(row.public_address),
        status: row.status,
    };
}
export class CustomerControllerRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async findByCustomer(customerUserId) {
        const result = await this.pool.query('SELECT * FROM customer_controllers WHERE customer_user_id = $1', [customerUserId]);
        return result.rows[0] ? mapController(result.rows[0]) : null;
    }
    async createIdempotent(customerUserId, identity) {
        await this.pool.query(`INSERT INTO customer_controllers
        (customer_user_id, key_reference, public_address, key_version)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (customer_user_id) DO NOTHING`, [
            customerUserId,
            identity.keyReference,
            identity.publicAddress,
            identity.keyVersion,
        ]);
        const persisted = await this.findByCustomer(customerUserId);
        if (!persisted)
            throw new Error('CONTROLLER_PERSIST_FAILED');
        return persisted;
    }
}
//# sourceMappingURL=customer-controller.repository.js.map