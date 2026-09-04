import { buildProviderPrompt, type ProviderPromptScenario } from "./prompt";
import type { StrategicPlan } from "./schemas";
import { parseProviderStrategicPlan, strategicPlanJsonSchema } from "./schemas";
import { invokeStructuredProvider, type StructuredInvocationRunner } from "./structured-invocation";

export interface LivePlannerInput {
  readonly provider: "codex" | "claude";
  readonly requestId: string;
  readonly orderText: string;
  readonly stateJson: string;
  readonly timeoutMs?: number;
  readonly nationCount?: number;
  readonly scenario?: ProviderPromptScenario;
  readonly runner?: StructuredInvocationRunner;
}

export const planWithLiveProvider = async (input: LivePlannerInput): Promise<StrategicPlan> => {
  const prompt = buildProviderPrompt({
    requestId: input.requestId,
    orderText: input.orderText,
    stateJson: input.stateJson,
    ...(input.nationCount === undefined ? {} : { nationCount: input.nationCount }),
    ...(input.scenario === undefined ? {} : { scenario: input.scenario }),
  });
  return invokeStructuredProvider({
    provider: input.provider,
    requestId: input.requestId,
    prompt,
    jsonSchema: strategicPlanJsonSchema(),
    parse: parseProviderStrategicPlan,
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
    ...(input.runner === undefined ? {} : { runner: input.runner }),
  });
};
