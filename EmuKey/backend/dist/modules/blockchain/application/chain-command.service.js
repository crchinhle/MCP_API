import { ChainSubmissionUnknownError, } from './ports/chain-relayer.port.js';
export class ChainCommandService {
    repository;
    relayer;
    envelopes;
    recovery;
    constructor(repository, relayer, envelopes, recovery) {
        this.repository = repository;
        this.relayer = relayer;
        this.envelopes = envelopes;
        this.recovery = recovery;
    }
    async processNext(workerId) {
        let command = await this.repository.claimNext(workerId);
        if (!command)
            return null;
        try {
            if (command.status === 'RETRYABLE_FAILED') {
                await this.repository.markPending(command.commandId, workerId);
            }
            if (command.commandType === 'ISSUE_LICENSE' || command.commandType === 'ROTATE_KEY') {
                if (this.recovery)
                    command = await this.recovery.ensure(command);
                const [envelope, durable] = await Promise.all([
                    this.envelopes.read(command.commandId),
                    command.commandType === 'ISSUE_LICENSE'
                        ? this.repository.getLicenseCommitment(command.licenseId)
                        : this.repository.getRotationCommitment(command.licenseId),
                ]);
                if (!envelope ||
                    !durable ||
                    envelope.licenseId !== command.licenseId ||
                    envelope.commitment !== durable.commitment ||
                    envelope.keyVersion !== durable.keyVersion ||
                    command.payload.activationCommitment !== durable.commitment ||
                    command.payload.keyVersion !== durable.keyVersion) {
                    throw new Error('ACTIVATION_ENVELOPE_PRECONDITION_FAILED');
                }
            }
            const transaction = await this.prepareTransaction(command);
            await this.relayer.broadcast(transaction);
            await this.repository.markSubmitted(command.commandId);
            return command.commandId;
        }
        catch (error) {
            if (error instanceof ChainSubmissionUnknownError) {
                await this.repository.markUnknown(command.commandId, error.transactionHash ?? command.transactionHash ?? undefined);
            }
            else {
                await this.repository.markFailure(command.commandId, command.attemptCount, error instanceof Error ? error.message : 'CHAIN_SUBMIT_FAILED');
            }
            return command.commandId;
        }
    }
    async reconcileUnknown(workerId) {
        const command = await this.repository.claimUnknown(workerId);
        if (!command)
            return null;
        try {
            const transaction = this.requirePrepared(command);
            const receipt = await this.relayer.receipt(transaction.transactionHash);
            if (receipt?.status === 'REVERTED') {
                await this.repository.markReverted(command.commandId, receipt);
            }
            else if (receipt) {
                await this.repository.markReceipt(command.commandId, receipt);
                await this.repository.markSubmitted(command.commandId);
            }
            else {
                await this.relayer.broadcast(transaction);
                await this.repository.markSubmitted(command.commandId);
            }
            return command.commandId;
        }
        catch (error) {
            if (error instanceof ChainSubmissionUnknownError) {
                await this.repository.markUnknown(command.commandId, error.transactionHash ?? command.transactionHash ?? undefined);
                return command.commandId;
            }
            await this.repository.releaseUnknown(command.commandId);
            return command.commandId;
        }
    }
    async reconcileReceipt(workerId) {
        const command = await this.repository.claimSubmitted(workerId);
        if (!command)
            return null;
        try {
            const transaction = this.requirePrepared(command);
            const receipt = await this.relayer.receipt(transaction.transactionHash);
            if (!receipt) {
                await this.repository.releaseSubmitted(command.commandId);
            }
            else if (receipt.status === 'REVERTED') {
                await this.repository.markReverted(command.commandId, receipt);
            }
            else {
                await this.repository.markReceipt(command.commandId, receipt);
            }
            return command.commandId;
        }
        catch {
            await this.repository.releaseSubmitted(command.commandId);
            return command.commandId;
        }
    }
    recoverDeadLetter(commandId, mode, reason, evidence, actor) {
        return this.repository.recoverDeadLetter(commandId, mode, reason, evidence, actor);
    }
    input(command) {
        return {
            chainId: command.chainId,
            commandId: command.commandId,
            commandType: command.commandType,
            contractAddress: command.contractAddress,
            network: command.network,
            payload: command.payload,
            payloadHash: command.payloadHash,
        };
    }
    async prepareTransaction(command) {
        if (command.signedTransaction || command.transactionHash) {
            return this.requirePrepared(command);
        }
        const input = this.input(command);
        let nonce = command.nonce;
        let relayerAddress = command.relayerAddress;
        if (nonce === null || !relayerAddress) {
            const context = await this.relayer.getSubmissionContext(input);
            relayerAddress = context.relayerAddress;
            nonce = await this.repository.reserveNonce(command.commandId, relayerAddress, context.pendingNonce);
        }
        const transaction = await this.relayer.prepare(input, nonce);
        if (transaction.relayerAddress.toLowerCase() !== relayerAddress.toLowerCase()) {
            throw new Error('CHAIN_RELAYER_CHANGED_DURING_PREPARATION');
        }
        return this.toPrepared(await this.repository.markPrepared(command.commandId, transaction));
    }
    requirePrepared(command) {
        if (command.nonce === null ||
            !command.relayerAddress ||
            !command.signedTransaction ||
            !command.transactionHash) {
            throw new Error('CHAIN_TRANSACTION_NOT_PREPARED');
        }
        return this.toPrepared(command);
    }
    toPrepared(command) {
        return {
            network: command.network,
            nonce: command.nonce,
            rawTransaction: command.signedTransaction,
            relayerAddress: command.relayerAddress,
            transactionHash: command.transactionHash,
        };
    }
}
//# sourceMappingURL=chain-command.service.js.map