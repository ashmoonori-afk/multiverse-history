import { z } from "zod";

import type { StrategicIntent, StrategicPlan } from "./schemas";
import { parseStrategicPlan } from "./schemas";

interface DeterministicNpcActor {
  readonly actorNationId: string;
  readonly provinceId: string;
  readonly treasuryCredits?: number;
  readonly tags?: readonly string[];
  readonly profile?: { readonly goalsKo: readonly string[] };
  readonly activeWars?: readonly {
    readonly attackerNationId: string;
    readonly targetNationId: string;
  }[];
}

export interface DeterministicPlanInput {
  readonly requestId: string;
  readonly orderText: string;
  readonly turn: number;
  readonly playerNationId?: string;
  readonly playerProvinceId?: string;
  readonly stateJson?: string;
  readonly validNationIds?: readonly string[];
  readonly validProvinceIds?: readonly string[];
  readonly npcActors?: readonly DeterministicNpcActor[];
}

const nationIdSchema = z.string().regex(/^nat_[a-z0-9_]+$/);
const provinceIdSchema = z.string().regex(/^prv_[a-z0-9_]+$/);
const plannerContextSchema = z
  .object({
    majorNations: z.array(
      z
        .object({
          id: nationIdSchema,
          treasuryCredits: z.number().safe().int().nonnegative(),
          tags: z.array(z.string()).optional(),
          profile: z
            .object({ goalsKo: z.array(z.string()) })
            .passthrough()
            .optional(),
          activeWars: z
            .array(
              z
                .object({
                  attackerNationId: nationIdSchema,
                  targetNationId: nationIdSchema,
                })
                .passthrough(),
            )
            .optional(),
        })
        .passthrough(),
    ),
    provinces: z.array(
      z.object({ id: provinceIdSchema, ownerNationId: nationIdSchema }).passthrough(),
    ),
    relations: z
      .array(
        z
          .object({
            fromNationId: nationIdSchema,
            toNationId: nationIdSchema,
            value: z.number().safe().int(),
          })
          .passthrough(),
      )
      .default([]),
    wars: z
      .array(
        z
          .object({
            attackerNationId: nationIdSchema,
            targetNationId: nationIdSchema,
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

type PlannerContext = z.infer<typeof plannerContextSchema>;

const parsePlannerContext = (stateJson: string | undefined): PlannerContext | undefined => {
  if (stateJson === undefined) return undefined;
  try {
    const parsed = plannerContextSchema.safeParse(JSON.parse(stateJson) as unknown);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

const actorsFromContext = (context: PlannerContext): readonly DeterministicNpcActor[] =>
  context.majorNations.flatMap((nation) => {
    const provinceId = context.provinces.find(
      (province) => province.ownerNationId === nation.id,
    )?.id;
    return provinceId === undefined
      ? []
      : [
          {
            actorNationId: nation.id,
            provinceId,
            treasuryCredits: nation.treasuryCredits,
            ...(nation.tags === undefined ? {} : { tags: nation.tags }),
            ...(nation.profile === undefined ? {} : { profile: nation.profile }),
            ...(nation.activeWars === undefined ? {} : { activeWars: nation.activeWars }),
          },
        ];
  });

const profileSector = (goalsKo: readonly string[]): string => {
  const goals = goalsKo.join(" ");
  if (/공항|항공/.test(goals)) return "airport";
  if (/항구|항만/.test(goals)) return "port";
  if (/조선|해군/.test(goals)) return "shipyard";
  if (/철도/.test(goals)) return "rail";
  return "industry";
};

const profileIntent = (
  actor: DeterministicNpcActor,
  index: number,
  context: PlannerContext,
): StrategicIntent => {
  const war =
    actor.activeWars?.[0] ??
    context.wars.find(
      (candidate) =>
        candidate.attackerNationId === actor.actorNationId ||
        candidate.targetNationId === actor.actorNationId,
    );
  if (war !== undefined) {
    return {
      type: "military.recruit",
      actorNationId: actor.actorNationId,
      provinceId: actor.provinceId,
      manpower: 2_000 + index * 500,
    };
  }
  if ((actor.treasuryCredits ?? 0) > 300) {
    return {
      type: "economy.invest",
      actorNationId: actor.actorNationId,
      provinceId: actor.provinceId,
      sector: profileSector(actor.profile?.goalsKo ?? []),
      budgetCredits: 40,
    };
  }
  const hostileRelation = context.relations.find(
    (relation) =>
      relation.value < -2_000 &&
      (relation.fromNationId === actor.actorNationId ||
        relation.toNationId === actor.actorNationId),
  );
  if (hostileRelation !== undefined) {
    const targetNationId =
      hostileRelation.fromNationId === actor.actorNationId
        ? hostileRelation.toNationId
        : hostileRelation.fromNationId;
    return {
      type: "relation.adjust",
      fromNationId: actor.actorNationId,
      toNationId: targetNationId,
      delta: -250,
      reasonKo: "적대 관계에 대응해 외교적 압박을 강화했다.",
    };
  }
  if (actor.tags?.includes("reformist") === true) {
    return {
      type: "nation.adjust",
      nationId: actor.actorNationId,
      stabilityDelta: 100,
      reasonKo: "개혁 정책을 추진해 국내 안정을 높였다.",
    };
  }
  const goals = actor.profile?.goalsKo.join(" ") ?? "";
  if (/경제|산업|개발|교역|무역|철도|항구/.test(goals)) {
    return {
      type: "economy.invest",
      actorNationId: actor.actorNationId,
      provinceId: actor.provinceId,
      sector: profileSector(actor.profile?.goalsKo ?? []),
      budgetCredits: 20,
    };
  }
  return {
    type: "military.recruit",
    actorNationId: actor.actorNationId,
    provinceId: actor.provinceId,
    manpower: 2_000 + index * 500,
  };
};

const npcIntents = (
  turn: number,
  actors: readonly DeterministicNpcActor[],
  context: PlannerContext | undefined,
): readonly StrategicIntent[] => {
  if (actors.length === 0) {
    return Object.freeze([]);
  }
  const maxActors = Math.min(actors.length, 32);
  const selected = actors.slice(0, maxActors);
  return Object.freeze(
    selected.map((actor, index) => {
      if (context !== undefined && actor.treasuryCredits !== undefined) {
        return profileIntent(actor, index, context);
      }
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
  const construction = orderText.match(
    /([가-힣A-Za-z0-9_]+)에\s+([가-힣A-Za-z0-9_][가-힣A-Za-z0-9_ ]*?)(?:을|를)\s*건설(?:한다|하다|해라|하라)?/,
  );
  const noun = construction?.[2]?.trim();
  if (!intents.some((intent) => intent.type === "economy.invest") && noun !== undefined) {
    const fixedSectors: Readonly<Record<string, string>> = Object.freeze({
      공항: "airport",
      비행장: "airfield",
      항구: "port",
      항만: "port",
      조선소: "shipyard",
      전신망: "telegraph",
      철도: "rail",
      도로: "road",
      공장: "factory",
    });
    intents.push({
      type: "economy.invest",
      actorNationId: playerNationId,
      provinceId: playerProvinceId,
      sector: fixedSectors[noun] ?? "construction",
      budgetCredits: 25,
      sourceQuoteKo: construction?.[0].slice(0, 200) ?? noun,
    });
  }
  if (intents.length === 0) {
    const trimmedOrder = orderText.trim().slice(0, 200);
    const attemptKo = trimmedOrder.length >= 2 ? trimmedOrder : "명령 내용 없음";
    intents.push({
      type: "action.fail",
      actorNationId: playerNationId,
      attemptKo,
      stabilityDelta: -100,
      sourceQuoteKo: attemptKo,
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
  intents.some((intent) => intent.type === "action.fail")
    ? `${actorNames}${extraHint} 등 ${npcCount}개국이 자국의 이해관계에 따라 행동한 가운데, 플레이어 국가의 명령은 실행 가능한 정책으로 해석되지 못해 실패한 시도로 기록되었다.`
    : intents.length > 0
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
  const context = parsePlannerContext(input.stateJson);
  const contextualActors = context === undefined ? [] : actorsFromContext(context);
  const actors =
    contextualActors.length > 0
      ? contextualActors
      : (input.npcActors ??
        [
          { actorNationId: "nat_jpn", provinceId: "prv_jpn_kanto" },
          { actorNationId: "nat_qing", provinceId: "prv_qing_zhili" },
          { actorNationId: "nat_rus", provinceId: "prv_rus_primorye" },
        ].filter((actor) => validNationIds.includes(actor.actorNationId)));
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
  const generatedNpcIntents = npcIntents(input.turn, fallbackActors, context);
  const hasTrade = generatedNpcIntents.some((intent) => intent.type === "diplomacy.propose_treaty");
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
    npcIntents: generatedNpcIntents,
    narrative: { ko: narrativeKo },
    warnings: [],
  });
};
