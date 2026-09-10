const normalizeKey = (key: string) =>
  key.replace(/[^a-z0-9]/gi, "").toLowerCase();
const PRIVATE_KEYS = new Set([
  "apikey",
  "databaseurl",
  "authorization",
  "credential",
  "credentials",
  "secret",
  "password",
  "rawprompt",
  "rawchainofthought",
  "rawreasoning",
  "providercredential",
]);
const isCredentialToken = (key: string) =>
  key === "token" ||
  /^(access|refresh|auth|bearer|session|provider|api)token$/.test(key);
const isPrivateKey = (key: string) => {
  const normalized = normalizeKey(key);
  return PRIVATE_KEYS.has(normalized) || normalized.endsWith("apikey") || isCredentialToken(normalized);
};

export const assertMetadataOnly = (value: unknown, path = "root"): void => {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer)
    throw new InvalidDurablePayloadError(
      `Binary data is forbidden in Postgres metadata: ${path}`,
    );
  if (
    typeof value === "string" &&
    /^data:(?:image|application\/(?:pdf|zip));base64,/i.test(value)
  )
    throw new InvalidDurablePayloadError(
      `Base64 binary is forbidden in Postgres metadata: ${path}`,
    );
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertMetadataOnly(item, `${path}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      if (isPrivateKey(key))
        throw new InvalidDurablePayloadError(
          `Private field is forbidden in durable state: ${path}.${key}`,
        );
      assertMetadataOnly(item, `${path}.${key}`);
    }
};
import { InvalidDurablePayloadError } from "./errors.js";
