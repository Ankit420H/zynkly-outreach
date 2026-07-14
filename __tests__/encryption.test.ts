import { encrypt, decrypt } from "@/lib/encryption";

// Set the encryption key for tests
process.env.SMTP_ENCRYPTION_KEY = "test-encryption-key-32-chars-long!";

describe("SMTP Encryption", () => {
  it("encrypts a string", () => {
    const encrypted = encrypt("my-smtp-password");
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toBe("my-smtp-password");
  });

  it("decrypts back to original", () => {
    const original = "secret-password-123";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time", () => {
    const enc1 = encrypt("same-password");
    const enc2 = encrypt("same-password");
    expect(enc1).not.toBe(enc2);
  });

  it("decryption fails with wrong key", () => {
    const encrypted = encrypt("my-password");
    process.env.SMTP_ENCRYPTION_KEY = "different-wrong-key-32-chars-long";
    const decrypted = decrypt(encrypted);
    expect(decrypted).not.toBe("my-password");
    // Restore
    process.env.SMTP_ENCRYPTION_KEY = "test-encryption-key-32-chars-long!";
  });

  it("throws if key is not set", () => {
    delete process.env.SMTP_ENCRYPTION_KEY;
    expect(() => encrypt("anything")).toThrow("SMTP_ENCRYPTION_KEY is not configured");
    // Restore
    process.env.SMTP_ENCRYPTION_KEY = "test-encryption-key-32-chars-long!";
  });
});
