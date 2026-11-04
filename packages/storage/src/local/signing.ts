import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { ENCRYPTION_KEY } from "../constants";

/**
 * Signed tokens for the local backend: the upload policy a browser posts back with its file, and the link
 * a signed download follows. The key is derived from ENCRYPTION_KEY with HKDF, so it is never the
 * encryption key itself and cannot be confused with what another feature derives from it.
 */
export type TLocalTokenPurpose = "upload" | "download";

const HKDF_INFO = "gforms-local-storage-v1";

const getSigningKey = (): Buffer | null => {
  const secret = ENCRYPTION_KEY?.trim();
  if (!secret) return null;
  return Buffer.from(hkdfSync("sha256", secret, "", HKDF_INFO, 32));
};

/** Whether tokens can be signed at all: false without ENCRYPTION_KEY. */
export const canSignLocalTokens = (): boolean => getSigningKey() !== null;

const computeSignature = (key: Buffer, purpose: TLocalTokenPurpose, payload: string): Buffer =>
  createHmac("sha256", key).update(`${purpose}\n${payload}`).digest();

/** The payload, encoded for a form field or a query parameter. */
export const encodeLocalTokenPayload = (payload: object): string =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

/** Signs an encoded payload. Null without ENCRYPTION_KEY. */
export const signLocalToken = (purpose: TLocalTokenPurpose, encodedPayload: string): string | null => {
  const key = getSigningKey();
  if (!key) return null;
  return computeSignature(key, purpose, encodedPayload).toString("base64url");
};

/**
 * The decoded payload when `signature` is this purpose's signature of `encodedPayload`; null otherwise.
 * A signature made for the other purpose never verifies, so a download link cannot be posted as an upload.
 */
export const verifyLocalToken = (
  purpose: TLocalTokenPurpose,
  encodedPayload: string | undefined | null,
  signature: string | undefined | null
): unknown => {
  const key = getSigningKey();
  if (!key || !encodedPayload || !signature) return null;

  const expected = computeSignature(key, purpose, encodedPayload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
};
