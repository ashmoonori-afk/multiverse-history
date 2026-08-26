import { createHash } from "node:crypto";

const encodeString = (value: string): string => {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("String could not be encoded");
  }
  return encoded;
};

const serializeArray = (value: readonly unknown[]): string =>
  `[${value.map(canonicalStringify).join(",")}]`;

const serializeObject = (value: object): string => {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Canonical objects must be plain records");
  }
  const record: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${encodeString(key)}:${canonicalStringify(record[key])}`)
    .join(",")}}`;
};

export const canonicalStringify = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Canonical numbers must be safe integers");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return serializeArray(value);
  }
  if (typeof value === "object") {
    return serializeObject(value);
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
};

export const hashCanonical = (value: unknown): string =>
  createHash("sha256").update(canonicalStringify(value), "utf8").digest("hex");
