import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { activationCommitment } from '../../../platform/crypto/license-crypto.js';
export class RedisActivationEnvelope {
    redis;
    key;
    constructor(redis, keyHex) {
        this.redis = redis;
        if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
            throw new Error('ACTIVATION_ENVELOPE_KEY must contain exactly 32 bytes');
        }
        this.key = Buffer.from(keyHex, 'hex');
    }
    async prepare(data, ttlSeconds) {
        if (activationCommitment(data.secret) !== data.commitment) {
            throw new Error('ACTIVATION_COMMITMENT_MISMATCH');
        }
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        cipher.setAAD(this.aad(data));
        const ciphertext = Buffer.concat([
            cipher.update(Buffer.from(data.secret.slice(2), 'hex')),
            cipher.final(),
        ]);
        const stored = {
            authTag: cipher.getAuthTag().toString('base64'),
            ciphertext: ciphertext.toString('base64'),
            commitment: data.commitment,
            iv: iv.toString('base64'),
            keyVersion: data.keyVersion,
            licenseId: data.licenseId,
        };
        await this.redis.set(this.keyName(data.commandId), JSON.stringify(stored), 'EX', ttlSeconds);
    }
    async exists(commandId) {
        return (await this.redis.get(this.keyName(commandId))) !== null;
    }
    async consume(commandId) {
        const raw = await this.redis.eval("local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v", 1, this.keyName(commandId));
        return typeof raw === 'string' ? this.decrypt(commandId, raw) : null;
    }
    async read(commandId) {
        const raw = await this.redis.get(this.keyName(commandId));
        return raw === null ? null : this.decrypt(commandId, raw);
    }
    decrypt(commandId, raw) {
        const stored = JSON.parse(raw);
        const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(stored.iv, 'base64'));
        const base = {
            commandId,
            commitment: stored.commitment,
            keyVersion: stored.keyVersion,
            licenseId: stored.licenseId,
        };
        decipher.setAAD(this.aad(base));
        decipher.setAuthTag(Buffer.from(stored.authTag, 'base64'));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(stored.ciphertext, 'base64')),
            decipher.final(),
        ]);
        const secret = `0x${plaintext.toString('hex')}`;
        if (activationCommitment(secret) !== stored.commitment) {
            throw new Error('ACTIVATION_COMMITMENT_MISMATCH');
        }
        return { ...base, secret };
    }
    aad(data) {
        return Buffer.from(`${data.commandId}:${data.licenseId}:${data.keyVersion}:${data.commitment}`, 'utf8');
    }
    keyName(commandId) {
        return `activation-envelope:${commandId}`;
    }
}
//# sourceMappingURL=redis-activation-envelope.js.map