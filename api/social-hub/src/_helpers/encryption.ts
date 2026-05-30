import crypto from 'node:crypto';

/**
 * AES-256-GCM encryption for OAuth tokens at rest.
 * Same on-disk format as marketing-core's TotpService: `v1:iv:tag:ciphertext` (all hex).
 * Key is the 32-byte hex `MASTER_DEK_HEX` from env.
 */
export class TokenCrypto {
  private key: Buffer;
  constructor(keyHex: string) {
    if (!keyHex || keyHex.length !== 64) {
      throw new Error('TokenCrypto requires a 32-byte (64-hex) encryption key');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
  }

  decrypt(payload: string): string {
    const [version, ivHex, tagHex, ctHex] = payload.split(':');
    if (version !== 'v1' || !ivHex || !tagHex || !ctHex) {
      throw new Error('Unrecognised encrypted token format');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
  }
}
