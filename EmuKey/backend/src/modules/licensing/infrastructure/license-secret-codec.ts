import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedLicenseSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}

/** Shared authenticated envelope for persisted keys and server credentials. */
export class LicenseSecretCodec {
  private readonly key: Buffer;
  constructor(
    hexKey: string,
    readonly keyId = 'activation-v1',
  ) {
    if (!/^[a-f0-9]{64}$/i.test(hexKey))
      throw new Error('Invalid license storage encryption key');
    this.key = Buffer.from(hexKey, 'hex');
  }
  encrypt(secret: string, context: string): EncryptedLicenseSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyId: this.keyId,
    };
  }
  decrypt(secret: EncryptedLicenseSecret, context: string): string {
    if (secret.keyId !== this.keyId)
      throw new Error('Unknown license encryption key ID');
    const cipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(secret.iv, 'base64'),
    );
    cipher.setAAD(Buffer.from(context));
    cipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
    return Buffer.concat([
      cipher.update(Buffer.from(secret.ciphertext, 'base64')),
      cipher.final(),
    ]).toString('utf8');
  }
}
