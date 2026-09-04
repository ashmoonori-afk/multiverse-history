import {
  type StrategicIntent,
  type StrategicPlan,
  type StrategicTreatyClause,
  strategicPlanCore,
} from "../providers/schemas";

export interface GroundStrategicPlanInput {
  readonly plan: StrategicPlan;
  readonly orderText: string;
  readonly playerNationId: string;
  readonly playerProvinceIds: readonly string[];
}

const economyKeywords = /철도|철로|기반시설|인프라|rail|infrastructure/i;
const diplomacyKeywords = /통상|무역|교역|협정|조약|특구|입항|외교|trade|treaty|port/i;
const recruitmentKeywords = /모병|징병|병력|신병|군대|recruit|troops/i;
const territoryKeywords = /할양|병합|합병|양도|반환|영토|점령|조차|cede|annex|transfer/i;

const normalizedQuoteText = (value: string): string => value.replace(/[\p{P}\s]/gu, "");

const intentMatchesOrder = (intent: StrategicIntent, orderText: string): boolean => {
  if (intent.sourceQuoteKo !== undefined) {
    const quote = normalizedQuoteText(intent.sourceQuoteKo);
    return quote.length > 0 && normalizedQuoteText(orderText).includes(quote);
  }
  switch (intent.type) {
    case "economy.invest":
      return economyKeywords.test(orderText);
    case "diplomacy.propose_treaty":
      return diplomacyKeywords.test(orderText);
    case "military.recruit":
      return recruitmentKeywords.test(orderText);
    case "territory.transfer":
      return territoryKeywords.test(orderText);
    default:
      return false;
  }
};

const derivedTreatyClauses = (
  orderText: string,
  existing: readonly StrategicTreatyClause[],
): readonly StrategicTreatyClause[] => {
  const clauses = new Set(existing);
  if (/통상|무역|교역|특구|입항|trade|commerce|port/i.test(orderText)) clauses.add("trade");
  if (/특구|입항|항구|port access|special zone/i.test(orderText)) clauses.add("port_access");
  if (/무기\s*지원|무기류\s*지원|arms support|weapons support/i.test(orderText)) {
    clauses.add("weapons_support");
  }
  if (/교육\s*장교|장교\s*파견|officer training|training officers/i.test(orderText)) {
    clauses.add("officer_training");
  }
  return Object.freeze([...clauses]);
};

const inferredProvinceId = (
  orderText: string,
  playerProvinceIds: readonly string[],
): string | undefined => {
  const normalized = orderText.toLocaleLowerCase("ko-KR");
  const direct = playerProvinceIds.find((provinceId) =>
    normalized.includes(provinceId.replace(/^prv_[a-z]+_/, "").replaceAll("_", " ")),
  );
  if (direct !== undefined) return direct;
  if (normalized.includes("제주")) {
    return playerProvinceIds.find((provinceId) => provinceId.endsWith("_jeolla"));
  }
  return undefined;
};

const groundedTreatyIntent = (
  intent: Extract<StrategicIntent, { readonly type: "diplomacy.propose_treaty" }>,
  input: GroundStrategicPlanInput,
): StrategicIntent | undefined => {
  if (intent.recipientNationId === input.playerNationId) return undefined;
  const provinceId =
    intent.provinceId === undefined
      ? inferredProvinceId(input.orderText, input.playerProvinceIds)
      : intent.provinceId;
  return Object.freeze({
    ...intent,
    clauses: derivedTreatyClauses(input.orderText, intent.clauses),
    termsKo: input.orderText.trim(),
    ...(provinceId === undefined ? {} : { provinceId }),
  });
};

const belongsToPlayer = (intent: StrategicIntent, playerNationId: string): boolean => {
  switch (intent.type) {
    case "economy.invest":
    case "diplomacy.propose_treaty":
    case "military.recruit":
    case "territory.transfer":
    case "treaty.respond":
    case "treaty.terminate":
    case "war.declare":
    case "action.fail":
      return intent.actorNationId === playerNationId;
    case "nation.adjust":
    case "polity.change":
      return intent.nationId === playerNationId;
    case "relation.adjust":
      return intent.fromNationId === playerNationId;
    case "war.peace":
    case "unit.move":
    case "unit.attack":
    case "unit.disband":
      return true;
  }
};

const groundedPlayerIntent = (
  intent: StrategicIntent,
  input: GroundStrategicPlanInput,
): StrategicIntent | undefined => {
  if (
    !(belongsToPlayer(intent, input.playerNationId) && intentMatchesOrder(intent, input.orderText))
  ) {
    return undefined;
  }
  switch (intent.type) {
    case "economy.invest":
      return input.playerProvinceIds.includes(intent.provinceId) ? intent : undefined;
    case "diplomacy.propose_treaty":
      return groundedTreatyIntent(intent, input);
    case "military.recruit":
      return input.playerProvinceIds.includes(intent.provinceId) ? intent : undefined;
    case "territory.transfer":
      return intent.fromNationId !== intent.toNationId &&
        (intent.toNationId === input.playerNationId || intent.fromNationId === input.playerNationId)
        ? intent
        : undefined;
    case "nation.adjust":
    case "relation.adjust":
    case "treaty.respond":
    case "treaty.terminate":
    case "war.declare":
    case "war.peace":
    case "unit.move":
    case "unit.attack":
    case "unit.disband":
    case "polity.change":
    case "action.fail":
      return intent;
  }
};

export const groundStrategicPlan = (input: GroundStrategicPlanInput): StrategicPlan => {
  const playerIntents = input.plan.playerIntents.flatMap((intent) => {
    const grounded = groundedPlayerIntent(intent, input);
    return grounded === undefined ? [] : [grounded];
  });
  const droppedIntent = playerIntents.length !== input.plan.playerIntents.length;
  const warnings = Object.freeze([
    ...input.plan.warnings,
    ...(droppedIntent && !input.plan.warnings.includes("PLAYER_INTENT_UNGROUNDED")
      ? ["PLAYER_INTENT_UNGROUNDED"]
      : []),
  ]);
  return Object.freeze({
    ...(droppedIntent ? strategicPlanCore(input.plan) : input.plan),
    playerIntents: Object.freeze(playerIntents),
    warnings,
  });
};
