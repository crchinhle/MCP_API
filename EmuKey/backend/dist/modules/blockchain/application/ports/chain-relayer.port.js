export const CHAIN_RELAYER = Symbol('CHAIN_RELAYER');
export class ChainSubmissionUnknownError extends Error {
    transactionHash;
    constructor(transactionHash) {
        super('CHAIN_SUBMISSION_UNKNOWN');
        this.transactionHash = transactionHash;
    }
}
//# sourceMappingURL=chain-relayer.port.js.map