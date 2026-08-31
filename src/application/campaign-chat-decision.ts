import type { CampaignChatDecision, CampaignChatMessage, CampaignChatTopic } from "./campaign-chat";
import type { CampaignState } from "./campaign-state";

interface CounterpartReplyInput {
  readonly state: CampaignState;
  readonly targetNationId: string;
  readonly decision: CampaignChatDecision;
}

export interface ClassifyCampaignChatInput {
  readonly state: CampaignState;
  readonly targetNationId: string;
  readonly message: string;
}

const containsAny = (value: string, fragments: readonly string[]): boolean =>
  fragments.some((fragment) => value.includes(fragment));

const explicitTopic = (message: string): CampaignChatTopic | undefined => {
  if (containsAny(message, ["통상", "무역", "관세", "철도", "협정"])) {
    return "trade";
  }
  if (containsAny(message, ["군사", "병력", "전쟁", "공격", "방위"])) {
    return "military";
  }
  if (containsAny(message, ["관계", "외교", "회담", "사절"])) {
    return "relations";
  }
  return undefined;
};

const latestCounterpartContext = (
  state: CampaignState,
  targetNationId: string,
): CampaignChatMessage | undefined =>
  state.chatMessages.reduce<CampaignChatMessage | undefined>(
    (latest, entry) =>
      entry.role === "counterpart" &&
      entry.speakerNationId === targetNationId &&
      entry.targetNationId === state.playerNationId
        ? entry
        : latest,
    undefined,
  );

export const classifyCampaignChatMessage = (
  input: ClassifyCampaignChatInput,
): CampaignChatDecision => {
  const normalized = input.message.toLocaleLowerCase("ko-KR");
  const context = latestCounterpartContext(input.state, input.targetNationId);
  const topic = explicitTopic(normalized) ?? context?.topic ?? "general";
  const base = {
    topic,
    ...(context === undefined ? {} : { replyToMessageId: context.id }),
  };
  if (containsAny(normalized, ["싫", "거절", "안 해", "안함", "필요 없", "하지 않", "철회"])) {
    return { ...base, intent: "rejection" };
  }
  if (containsAny(normalized, ["수락", "동의", "좋아", "좋습니다", "진행하", "받아들"])) {
    return { ...base, intent: "acceptance" };
  }
  if (
    normalized.includes("?") ||
    containsAny(normalized, ["무엇", "왜", "어떻게", "알려", "설명", "요약", "조건"])
  ) {
    return { ...base, intent: "question" };
  }
  return { ...base, intent: "statement" };
};

export const deterministicCounterpartReply = (input: CounterpartReplyInput): string => {
  const target = input.state.nations.find((nation) => nation.id === input.targetNationId);
  const targetName = target?.nameKo ?? input.targetNationId;
  const relationValue =
    input.state.relations.find(
      (relation) =>
        relation.fromNationId === input.state.playerNationId &&
        relation.toNationId === input.targetNationId,
    )?.value ?? 0;
  switch (input.decision.intent) {
    case "rejection":
      return input.decision.topic === "trade"
        ? `${targetName} 외교부는 귀국이 이번 통상 협정 제안을 거절한 것으로 이해했습니다. 해당 안건에 대한 후속 협의는 중단하고 추가 제안을 기다리겠습니다.`
        : `${targetName} 외교부는 귀국의 거절 의사를 확인했습니다. 해당 안건은 보류하겠습니다.`;
    case "acceptance":
      return input.decision.topic === "trade"
        ? `${targetName} 외교부는 귀국의 통상 협상 수락 의사를 확인했습니다. 관세와 철도 연결 조건을 다룰 실무 회담 일정을 제안하겠습니다.`
        : `${targetName} 외교부는 귀국의 동의 의사를 확인했습니다. 후속 절차를 준비하겠습니다.`;
    case "question":
      return input.decision.topic === "trade"
        ? `${targetName} 외교부가 제안한 핵심 조건은 상호 관세 인하와 철도 화물 연결입니다. 현재 양국 관계 지수는 ${relationValue}이며, 세부 조건은 추가 협상으로 조정할 수 있습니다.`
        : `${targetName} 외교부는 현재 안건을 검토 중입니다. 질문할 분야를 외교·군사·통상 중에서 지정해 주시면 구체적으로 답하겠습니다.`;
    case "statement":
      return input.decision.topic === "trade"
        ? `${targetName} 외교부는 귀국의 입장을 통상 협상 기록에 반영했습니다. 수정할 조건이 있다면 관세·철도·이행 시한을 구체적으로 제시해 주십시오.`
        : `${targetName} 외교부는 귀국의 입장을 공식 기록에 반영했습니다. 필요한 후속 조치를 구체적으로 알려 주십시오.`;
  }
};
