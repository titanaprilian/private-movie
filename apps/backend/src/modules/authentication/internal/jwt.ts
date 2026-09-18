import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const INSECURE_PLACEHOLDERS = [
  "default-jwt-secret-key-change-in-production",
  "secret",
  "changeme",
  "jwt-secret",
];

export function validateJwtSecret(): void {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim() === "" || INSECURE_PLACEHOLDERS.includes(secret.trim().toLowerCase())) {
      throw new Error(
        "FATAL: Insecure or missing JWT_SECRET in production environment. Please provide a secure JWT_SECRET."
      );
    }
  }
}

function getJwtSecret(): string {
  validateJwtSecret();
  return process.env.JWT_SECRET || "default-jwt-secret-key-change-in-production";
}

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

export function signJwt(payload: object, expiresInSeconds: number = 15 * 60): string {
  const secret = getJwtSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(signatureInput)
    .digest("base64url");

  return `${signatureInput}.${signature}`;
}

export function verifyJwt(token: string): { sub: string; email?: string; name?: string; exp?: number } {
  const secret = getJwtSecret();
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const [encodedHeader, encodedPayload, signature] = parts;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64urlDecode(encodedHeader));
  } catch {
    throw new Error("Invalid token header format");
  }

  if (header.alg !== "HS256") {
    throw new Error("Unsupported or invalid algorithm");
  }

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = createHmac("sha256", secret)
    .update(signatureInput)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length || !timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    throw new Error("Invalid signature");
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload));
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new Error("Token expired");
  }

  return payload;
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
