/**
 * MediRoute India — AES-256-GCM Application-Level Encryption
 * Used to encrypt PII (e.g. passport numbers) and TOTP secrets before database storage.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

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
  if (!textToEncrypt || textToEncrypt === '""' || textToEncrypt === '[]') return '';

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
 * Supports legacy unencrypted values by returning the original string if parsing or decryption fails.
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
  
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      return ciphertext;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decryptedUpdate = decipher.update(encrypted);
    const decryptedFinal = decipher.final();
    
    return Buffer.concat([decryptedUpdate, decryptedFinal]).toString('utf8');
  } catch (err) {
    console.error('[Decryption Error] Failed to decrypt value. Returning raw ciphertext.', err);
    return ciphertext;
  }
}
