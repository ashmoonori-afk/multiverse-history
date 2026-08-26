import { parseNationId } from "../../../shared/ids";
import type { NationDefinition, RelationDefinition } from "../registry";

export const eastAsiaNations: readonly NationDefinition[] = Object.freeze([
  Object.freeze({
    id: parseNationId("nat_kor"),
    nameKo: "대한제국",
    capitalLabelKo: "한성 수도",
    legalActions: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
    treasuryCredits: 240,
    gdpCredits: 1_200,
    taxRateBps: 1_500,
    stabilityBps: 5_800,
    population: 17_082_000,
    infrastructureBps: 2_400,
  }),
  Object.freeze({
    id: parseNationId("nat_jpn"),
    nameKo: "일본제국",
    capitalLabelKo: "도쿄 수도",
    legalActions: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
    treasuryCredits: 760,
    gdpCredits: 3_900,
    taxRateBps: 1_900,
    stabilityBps: 7_000,
    population: 43_850_000,
    infrastructureBps: 4_600,
  }),
  Object.freeze({
    id: parseNationId("nat_qing"),
    nameKo: "청제국",
    capitalLabelKo: "베이징 수도",
    legalActions: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
    treasuryCredits: 1_100,
    gdpCredits: 8_400,
    taxRateBps: 1_200,
    stabilityBps: 4_600,
    population: 400_000_000,
    infrastructureBps: 1_800,
  }),
  Object.freeze({
    id: parseNationId("nat_rus"),
    nameKo: "러시아제국",
    capitalLabelKo: "상트페테르부르크 수도",
    legalActions: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
    treasuryCredits: 2_300,
    gdpCredits: 13_500,
    taxRateBps: 1_800,
    stabilityBps: 5_900,
    population: 136_000_000,
    infrastructureBps: 3_900,
  }),
]);

export const eastAsiaRelations: readonly RelationDefinition[] = Object.freeze([
  Object.freeze({
    fromNationId: parseNationId("nat_kor"),
    toNationId: parseNationId("nat_jpn"),
    value: -500,
  }),
  Object.freeze({
    fromNationId: parseNationId("nat_kor"),
    toNationId: parseNationId("nat_qing"),
    value: 1_000,
  }),
  Object.freeze({
    fromNationId: parseNationId("nat_kor"),
    toNationId: parseNationId("nat_rus"),
    value: 250,
  }),
  Object.freeze({
    fromNationId: parseNationId("nat_qing"),
    toNationId: parseNationId("nat_rus"),
    value: 100,
  }),
]);
