/**
 * Afzal Healthcare — AES-256-GCM Application-Level Encryption
 * Used to encrypt PII (e.g. passport numbers) and TOTP secrets before database storage.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HEX_RE = /^[0-9a-fA-F]+$/;

export class DecryptionTamperError extends Error {
  constructor(message = 'Encrypted field failed GCM authentication check') {
    super(message);
    this.name = 'DecryptionTamperError';
  }
}

function getEncryptionKey(): Buffer {
  let keyHex = process.env.ENCRYPTION_KEY;

  // Fallback for dev / testing environments
  if (!keyHex && process.env.NODE_ENV !== 'production') {
    keyHex = '0000000000000000000000000000000000000000000000000000000000000000';
  }

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not configured');
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext
 */
export function encrypt(text: unknown): string {
  if (text === null || text === undefined || text === '') return '';

  const textToEncrypt = typeof text === 'string' ? text : JSON.stringify(text);
  if (!textToEncrypt || textToEncrypt === '""') return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Supports legacy unencrypted values by returning the original string if the input is not formatted as iv:authTag:ciphertext.
 * Throws DecryptionTamperError when a properly formatted ciphertext fails GCM authentication.
 */
export function decrypt(ciphertext: unknown): string {
  if (!ciphertext) return '';
  if (typeof ciphertext !== 'string') {
    return String(ciphertext);
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    // Return original if it doesn't match iv:authTag:ciphertext format
    return ciphertext;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (
    ivHex.length !== IV_LENGTH * 2 ||
    authTagHex.length !== AUTH_TAG_LENGTH * 2 ||
    !HEX_RE.test(ivHex) ||
    !HEX_RE.test(authTagHex) ||
    (encryptedHex.length > 0 && !HEX_RE.test(encryptedHex))
  ) {
    return ciphertext;
  }

  const key = getEncryptionKey();

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const decryptedUpdate = decipher.update(Buffer.from(encryptedHex, 'hex'));
    const decryptedFinal = decipher.final();

    return Buffer.concat([decryptedUpdate, decryptedFinal]).toString('utf8');
  } catch {
    throw new DecryptionTamperError();
  }
}
