import type { StrategicIntent, StrategicPlan } from "./schemas";
import { parseStrategicPlan } from "./schemas";

export interface DeterministicPlanInput {
  readonly requestId: string;
  readonly orderText: string;
  readonly turn: number;
  readonly playerNationId?: string;
  readonly playerProvinceId?: string;
  readonly validNationIds?: readonly string[];
  readonly validProvinceIds?: readonly string[];
  readonly npcActors?: readonly {
    readonly actorNationId: string;
    readonly provinceId: string;
  }[];
}

const npcIntents = (
  turn: number,
  actors: readonly { readonly actorNationId: string; readonly provinceId: string }[],
): readonly StrategicIntent[] => {
  if (actors.length === 0) {
    return Object.freeze([]);
  }
  const maxActors = Math.min(actors.length, 16);
  const selected = actors.slice(0, maxActors);
  return Object.freeze(
    selected.map((actor, index) => {
      switch ((turn + index) % 3) {
        case 0:
          return {
            type: "military.recruit" as const,
            actorNationId: actor.actorNationId,
            provinceId: actor.provinceId,
            manpower: 2_000 + index * 500,
          };
        case 1:
          return {
            type: "economy.invest" as const,
            actorNationId: actor.actorNationId,
            provinceId: actor.provinceId,
            sector: "rail" as const,
            budgetCredits: Math.min(100, 30 + (index % 8) * 10),
          };
        default: {
          const recipientIndex = (index + 1) % selected.length;
          const recipient = selected[recipientIndex];
          if (recipient === undefined) {
            throw new RangeError("Deterministic NPC recipient is unavailable");
          }
          return {
            type: "diplomacy.propose_treaty" as const,
            actorNationId: actor.actorNationId,
            recipientNationId: recipient.actorNationId,
            clauses: ["trade"] as const,
          };
        }
      }
    }),
  );
};

const playerIntents = (
  orderText: string,
  playerNationId: string,
  playerProvinceId: string,
  recipientNationId: string,
): readonly StrategicIntent[] => {
  const intents: StrategicIntent[] = [];
  if (orderText.includes("철도")) {
    intents.push({
      type: "economy.invest",
      actorNationId: playerNationId,
      provinceId: playerProvinceId,
      sector: "rail",
      budgetCredits: 25,
      sourceQuoteKo: "철도",
    });
  }
  if (orderText.includes("통상") || orderText.includes("무역")) {
    intents.push({
      type: "diplomacy.propose_treaty",
      actorNationId: playerNationId,
      recipientNationId,
      clauses: ["trade"],
      sourceQuoteKo: orderText.includes("통상") ? "통상" : "무역",
    });
  }
  return Object.freeze(intents);
};

const turnNarrative = (
  intents: readonly StrategicIntent[],
  playerNationId: string,
  actorNames: string,
  extraHint: string,
  npcCount: number,
  hasTrade: boolean,
): string =>
  intents.length > 0
    ? `${playerNationId === "nat_kor" ? "대한제국" : "플레이어 국가"}이 철도 확충과 통상 외교를 추진하는 가운데, ${actorNames}${extraHint} 등 ${npcCount}개국이 각자의 국가 전략을 실행했다.${hasTrade ? " 외교 협상이 오가는 가운데 역내 긴장과 협력의 줄다리기가 계속되고 있다." : " 군비 경쟁과 기반시설 투자가 맞물리며 동아시아 정세는 새로운 국면을 맞고 있다."}`
    : `${actorNames}${extraHint} 등 ${npcCount}개국이 자국의 이해관계에 따라 행동했으나, 플레이어 국가의 명령은 구체적 의도로 해석되지 못했다. 기존 정책 기조가 유지되는 가운데 역내 움직임은 계속된다.`;

export const planDeterministically = (input: DeterministicPlanInput): StrategicPlan => {
  if (!Number.isSafeInteger(input.turn) || input.turn < 0) {
    throw new RangeError("Turn must be a non-negative safe integer");
  }
  const playerNationId = input.playerNationId ?? "nat_kor";
  const playerProvinceId = input.playerProvinceId ?? "prv_kor_hanseong";
  const validNationIds = input.validNationIds ?? ["nat_kor", "nat_jpn", "nat_qing", "nat_rus"];
  const validProvinceIds = input.validProvinceIds ?? [
    "prv_kor_hanseong",
    "prv_jpn_kanto",
    "prv_qing_zhili",
    "prv_rus_primorye",
  ];
  const recipientNationId =
    validNationIds.find((nationId) => nationId !== playerNationId) ?? "nat_jpn";
  const actors =
    input.npcActors ??
    [
      { actorNationId: "nat_jpn", provinceId: "prv_jpn_kanto" },
      { actorNationId: "nat_qing", provinceId: "prv_qing_zhili" },
      { actorNationId: "nat_rus", provinceId: "prv_rus_primorye" },
    ].filter((actor) => validNationIds.includes(actor.actorNationId));
  const fallbackActors =
    actors.length > 0
      ? actors
      : validProvinceIds[0] === undefined
        ? []
        : [{ actorNationId: recipientNationId, provinceId: validProvinceIds[0] }];
  const intents = playerIntents(
    input.orderText,
    playerNationId,
    playerProvinceId,
    recipientNationId,
  );
  const npcCount = fallbackActors.length;
  const nameMap: Record<string, string> = {
    nat_kor: "대한제국",
    nat_jpn: "일본제국",
    nat_qing: "청제국",
    nat_rus: "러시아제국",
    nat_gbr: "대영제국",
    nat_fra: "프랑스제국",
    nat_deu: "독일제국",
    nat_usa: "미합중국",
    nat_nld: "네덜란드제국",
    nat_tha: "시암왕국",
  };
  const maxNamedActors = 5;
  const actorNames = fallbackActors
    .slice(0, maxNamedActors)
    .map((actor) => nameMap[actor.actorNationId] ?? actor.actorNationId)
    .join("·");
  const extraHint =
    fallbackActors.length > maxNamedActors
      ? ` 외 ${fallbackActors.length - maxNamedActors}개국`
      : "";
  const hasTrade = fallbackActors.some((_, index) => (input.turn + index) % 3 === 2);
  const narrativeKo = turnNarrative(
    intents,
    playerNationId,
    actorNames,
    extraHint,
    npcCount,
    hasTrade,
  );
  return parseStrategicPlan({
    schemaVersion: 1,
    requestId: input.requestId,
    playerIntents: intents,
    npcIntents: npcIntents(input.turn, fallbackActors),
    narrative: { ko: narrativeKo },
    warnings: intents.length > 0 ? [] : ["PLAYER_ORDER_NOT_RECOGNIZED"],
  });
};
