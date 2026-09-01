import { invokeStructuredProvider, type StructuredInvocationRunner } from "./structured-invocation";

/**
 * Warm the subscription CLI once so the first real in-game request skips the
 * cold-start cost (process bootstrap, auth token refresh, OS file caches).
 * Fired at server start; failures are swallowed and retried on the next call.
 */
const warmupJsonSchema = Object.freeze({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
  additionalProperties: false,
});

const warmupPrompt = ["연결 예열 확인.", '반드시 {"ok":true} JSON만 반환한다.'].join("\n");

const warmupByProvider = new Map<string, Promise<boolean>>();

export const warmUpProvider = (
  provider: "codex" | "claude",
  runner?: StructuredInvocationRunner,
): Promise<boolean> => {
  const pending = warmupByProvider.get(provider);
  if (pending !== undefined) {
    return pending;
  }
  const warmup = invokeStructuredProvider({
    provider,
    prompt: warmupPrompt,
    jsonSchema: warmupJsonSchema,
    parse: (value) => value,
    timeoutMs: 120_000,
    ...(runner === undefined ? {} : { runner }),
  })
    .then(() => true)
    .catch(() => {
      warmupByProvider.delete(provider);
      return false;
    });
  warmupByProvider.set(provider, warmup);
  return warmup;
};

export const resetProviderWarmupForTests = (): void => {
  warmupByProvider.clear();
};
