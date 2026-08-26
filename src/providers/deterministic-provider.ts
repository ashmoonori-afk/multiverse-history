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
  const choices = actors.map((actor, index) => ({
    type: "military.recruit" as const,
    actorNationId: actor.actorNationId,
    provinceId: actor.provinceId,
    manpower: 2_000 + index * 500,
  }));
  const selected = choices[turn % choices.length];
  if (selected === undefined) {
    throw new RangeError("Deterministic NPC choice is unavailable");
  }
  return Object.freeze([selected]);
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
    });
  }
  if (orderText.includes("통상") || orderText.includes("무역")) {
    intents.push({
      type: "diplomacy.propose_treaty",
      actorNationId: playerNationId,
      recipientNationId,
      clauses: ["trade"],
    });
  }
  return Object.freeze(intents);
};

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
  return parseStrategicPlan({
    schemaVersion: 1,
    requestId: input.requestId,
    playerIntents: intents,
    npcIntents: npcIntents(input.turn, fallbackActors),
    narrative: {
      ko:
        intents.length > 0
          ? playerNationId === "nat_kor"
            ? "대한제국은 철도 확충과 통상 외교를 준비했다."
            : "플레이어 국가는 철도 확충과 통상 외교를 준비했다."
          : "플레이어 국가의 명령을 구조화하지 못해 기존 정책을 유지했다.",
    },
    warnings: intents.length > 0 ? [] : ["PLAYER_ORDER_NOT_RECOGNIZED"],
  });
};
