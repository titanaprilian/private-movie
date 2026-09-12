import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

// Default test fallback encryption key: 32 bytes (64 hex characters)
const DEFAULT_FALLBACK_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function getEncryptionKey(): Buffer {
  const envKey = process.env.STORAGE_ENCRYPTION_KEY?.trim();
  const hexKey = envKey && envKey.length === 64 ? envKey : DEFAULT_FALLBACK_KEY;
  return Buffer.from(hexKey, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: `iv:authTag:ciphertext` in hexadecimal encoding.
 */
export function encryptCredential(
  plaintext: string,
  customKeyHex?: string
): string {
  if (plaintext === undefined || plaintext === null) {
    throw new Error("Plaintext cannot be null or undefined");
  }

  const key = customKeyHex
    ? Buffer.from(customKeyHex, "hex")
    : getEncryptionKey();

  if (key.length !== 32) {
    throw new Error("Encryption key must be exactly 32 bytes (64 hex chars)");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Input format: `iv:authTag:ciphertext` in hexadecimal encoding.
 */
export function decryptCredential(
  encryptedPayload: string,
  customKeyHex?: string
): string {
  if (!encryptedPayload) {
    throw new Error("Encrypted payload cannot be empty");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format (expected iv:authTag:ciphertext)");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length in encrypted payload");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length in encrypted payload");
  }

  const key = customKeyHex
    ? Buffer.from(customKeyHex, "hex")
    : getEncryptionKey();

  if (key.length !== 32) {
    throw new Error("Encryption key must be exactly 32 bytes (64 hex chars)");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Mask an access key id (e.g. `••••1234` or `••••••••1234`).
 */
export function maskAccessKeyId(accessKeyId: string): string {
  if (!accessKeyId) return "";
  const trimmed = accessKeyId.trim();
  if (trimmed.length <= 4) {
    return "••••" + trimmed;
  }
  const lastFour = trimmed.slice(-4);
  return `••••••••${lastFour}`;
}
