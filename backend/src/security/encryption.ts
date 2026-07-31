import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { tokenConfig } from "../config.js";

const algorithm = "aes-256-gcm";

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function getEncryptionKey() {
  const encodedKey = tokenConfig.encryptionKey;
  if (!encodedKey) throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

export function encryptToken(token: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    keyVersion: 1,
  };
}

export function decryptToken(encryptedToken: EncryptedToken): string {
  if (encryptedToken.keyVersion !== 1) {
    throw new Error(`Unsupported token key version: ${encryptedToken.keyVersion}`);
  }

  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(encryptedToken.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encryptedToken.authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedToken.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
