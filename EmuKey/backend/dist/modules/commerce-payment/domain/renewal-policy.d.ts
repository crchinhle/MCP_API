/** Renewal preserves unused time and never bills for an already elapsed period. */
export declare function renewalExpiry(currentExpiry: Date, verifiedPaidAt: Date, months: number): Date;
