import { encrypt, decrypt } from '../crypto';

describe('Crypto Module AES-256-GCM', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  it('should encrypt and decrypt a message correctly', () => {
    const plainText = 'Hello, MediRoute India!';
    const encrypted = encrypt(plainText);

    // Verify it is encrypted and formatted correctly (iv:authTag:ciphertext)
    expect(encrypted).not.toBe(plainText);
    expect(encrypted.split(':').length).toBe(3);

    // Decrypt and compare
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should return empty string for empty inputs', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should handle legacy unencrypted strings gracefully by returning them', () => {
    const unencrypted = 'unencrypted_legacy_data';
    expect(decrypt(unencrypted)).toBe(unencrypted);

    const halfFormatted = 'only:two_parts';
    expect(decrypt(halfFormatted)).toBe(halfFormatted);
  });

  it('should handle non-string inputs gracefully without throwing', () => {
    const mockArray = ['Peanuts', 'Gluten'];
    const mockObject = { allergy: 'Dairy' };

    // Encrypt handles serializing objects/arrays
    const encryptedArray = encrypt(mockArray);
    const encryptedObject = encrypt(mockObject);

    expect(encryptedArray).not.toBe('');
    expect(encryptedObject).not.toBe('');

    // Decrypting them returns their stringified form
    expect(decrypt(encryptedArray)).toBe(JSON.stringify(mockArray));
    expect(decrypt(encryptedObject)).toBe(JSON.stringify(mockObject));

    // Passing non-string directly to decrypt returns stringified version or raw value
    expect(decrypt(mockArray)).toBe(String(mockArray));
    expect(decrypt(mockObject)).toBe(String(mockObject));
  });
});
