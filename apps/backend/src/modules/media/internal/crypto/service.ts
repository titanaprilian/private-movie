import type { CryptoSubtleRequestPayload } from "../types";

export class CryptoSubtleError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Protocol-independent WebCrypto subtle operations (AES-CBC encrypt/decrypt,
 * digest, HMAC sign/verify) executed with the server runtime's subtle crypto,
 * so insecure origins can proxy cryptographic calls through the backend.
 * Returns the base64-encoded result (or boolean for verify).
 */
export async function executeCryptoSubtleOperation(
  payload: CryptoSubtleRequestPayload
): Promise<string | boolean> {
  const { op, algorithm, keyRaw, keyAlgorithm, data } = payload;

  if (op === "decrypt" || op === "encrypt") {
    const keyBuf = Buffer.from(keyRaw || "", "base64");
    const dataBuf = Buffer.from(data, "base64");
    const algObj: Record<string, unknown> = { ...algorithm };
    if (typeof algObj.iv === "string") {
      algObj.iv = Buffer.from(algObj.iv, "base64");
    }
    if (typeof algObj.counter === "string") {
      algObj.counter = Buffer.from(algObj.counter, "base64");
    }

    const importedKey = await globalThis.crypto.subtle.importKey(
      "raw",
      keyBuf,
      (keyAlgorithm as unknown as AlgorithmIdentifier) || { name: algObj.name as string },
      false,
      [op as KeyUsage]
    );

    const result =
      op === "decrypt"
        ? await globalThis.crypto.subtle.decrypt(
            algObj as unknown as AesCbcParams,
            importedKey,
            dataBuf
          )
        : await globalThis.crypto.subtle.encrypt(
            algObj as unknown as AesCbcParams,
            importedKey,
            dataBuf
          );

    return Buffer.from(result).toString("base64");
  }

  if (op === "digest") {
    const dataBuf = Buffer.from(data, "base64");
    const algName = (algorithm.name as string) || (algorithm as unknown as string);
    const result = await globalThis.crypto.subtle.digest(
      algName,
      dataBuf
    );
    return Buffer.from(result).toString("base64");
  }

  if (op === "sign") {
    const keyBuf = Buffer.from(keyRaw || "", "base64");
    const dataBuf = Buffer.from(data, "base64");
    const algObj = { ...algorithm };

    const importedKey = await globalThis.crypto.subtle.importKey(
      "raw",
      keyBuf,
      (keyAlgorithm as unknown as AlgorithmIdentifier) || { name: (algObj.name as string) || "HMAC" },
      false,
      ["sign"]
    );

    const result = await globalThis.crypto.subtle.sign(
      algObj as unknown as AlgorithmIdentifier,
      importedKey,
      dataBuf
    );

    return Buffer.from(result).toString("base64");
  }

  if (op === "verify") {
    const keyBuf = Buffer.from(keyRaw || "", "base64");
    const dataBuf = Buffer.from(data, "base64");
    const sigBuf = Buffer.from(payload.signature || "", "base64");
    const algObj = { ...algorithm };

    const importedKey = await globalThis.crypto.subtle.importKey(
      "raw",
      keyBuf,
      (keyAlgorithm as unknown as AlgorithmIdentifier) || { name: (algObj.name as string) || "HMAC" },
      false,
      ["verify"]
    );

    const result = await globalThis.crypto.subtle.verify(
      algObj as unknown as AlgorithmIdentifier,
      importedKey,
      sigBuf,
      dataBuf
    );

    return result;
  }

  throw new CryptoSubtleError(400, "Unsupported operation");
}
