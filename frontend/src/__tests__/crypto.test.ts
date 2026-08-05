/**
 * @jest-environment node
 */
import { generateKey, encryptText, decryptText, exportKeyToBase64, importKeyFromBase64 } from '@/lib/crypto';

describe('crypto helpers (AES-GCM E2E encryption)', () => {
  it('round-trips plaintext through encrypt/decrypt', async () => {
    const key = await generateKey();
    const ciphertext = await encryptText(key, 'hello, paired device!');
    expect(ciphertext).not.toContain('hello');
    const plaintext = await decryptText(key, ciphertext);
    expect(plaintext).toBe('hello, paired device!');
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', async () => {
    const key = await generateKey();
    const a = await encryptText(key, 'same message');
    const b = await encryptText(key, 'same message');
    expect(a).not.toBe(b);
  });

  it('exported/imported keys round-trip and still decrypt correctly', async () => {
    const key = await generateKey();
    const b64 = await exportKeyToBase64(key);
    const importedKey = await importKeyFromBase64(b64);
    const ciphertext = await encryptText(key, 'cross-device secret');
    const plaintext = await decryptText(importedKey, ciphertext);
    expect(plaintext).toBe('cross-device secret');
  });

  it('fails to decrypt with the wrong key', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const ciphertext = await encryptText(key1, 'top secret');
    await expect(decryptText(key2, ciphertext)).rejects.toBeDefined();
  });
});
