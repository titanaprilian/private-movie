import { describe, expect, it } from "vitest";
import {
  decryptCredential,
  encryptCredential,
  maskAccessKeyId,
} from "../../../src/internal/s3/encryption";

describe("AES-256-GCM Encryption Module", () => {
  const testKey =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  it("encrypts and decrypts credentials accurately", () => {
    const plaintext = "my-secret-access-key-12345";
    const encrypted = encryptCredential(plaintext, testKey);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptCredential(encrypted, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it("generates unique IVs for identical plaintext inputs", () => {
    const plaintext = "same-secret-value";
    const enc1 = encryptCredential(plaintext, testKey);
    const enc2 = encryptCredential(plaintext, testKey);

    expect(enc1).not.toBe(enc2);
    expect(decryptCredential(enc1, testKey)).toBe(plaintext);
    expect(decryptCredential(enc2, testKey)).toBe(plaintext);
  });

  it("detects tampering with ciphertext or auth tag", () => {
    const plaintext = "confidential-data";
    const encrypted = encryptCredential(plaintext, testKey);
    const [iv, tag, cipher] = encrypted.split(":");

    // Tamper with ciphertext
    const tamperedCipher =
      cipher.slice(0, -2) + (cipher.slice(-2) === "00" ? "ff" : "00");
    const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

    expect(() => decryptCredential(tamperedPayload, testKey)).toThrow();

    // Tamper with tag
    const tamperedTag =
      tag.slice(0, -2) + (tag.slice(-2) === "00" ? "ff" : "00");
    const tamperedTagPayload = `${iv}:${tamperedTag}:${cipher}`;

    expect(() => decryptCredential(tamperedTagPayload, testKey)).toThrow();
  });

  it("throws error for invalid format", () => {
    expect(() => decryptCredential("not-valid-hex", testKey)).toThrow(
      "Invalid encrypted payload format"
    );
  });

  it("masks access key IDs with only last 4 chars visible", () => {
    expect(maskAccessKeyId("AKIAIOSFODNN7EXAMPLE")).toBe("••••••••MPLE");
    expect(maskAccessKeyId("1234")).toBe("••••1234");
    expect(maskAccessKeyId("abc")).toBe("••••abc");
  });
});
