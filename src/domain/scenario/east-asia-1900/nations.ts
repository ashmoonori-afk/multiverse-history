import { parseNationId } from "../../../shared/ids";
import type { NationDefinition, RelationDefinition } from "../registry";

const nation = (
  id: string,
  nameKo: string,
  capital: string,
  treasury: number,
  gdp: number,
  tax: number,
  stability: number,
  population: number,
  infrastructure: number,
): NationDefinition =>
  Object.freeze({
    id: parseNationId(id),
    nameKo,
    capitalLabelKo: capital,
    legalActions: ["economy.invest", "diplomacy.propose_treaty", "military.recruit"],
    treasuryCredits: treasury,
    gdpCredits: gdp,
    taxRateBps: tax,
    stabilityBps: stability,
    population,
    infrastructureBps: infrastructure,
  });

const relation = (from: string, to: string, value: number): RelationDefinition =>
  Object.freeze({
    fromNationId: parseNationId(from),
    toNationId: parseNationId(to),
    value,
  });

export const eastAsiaNations: readonly NationDefinition[] = Object.freeze([
  nation("nat_kor", "대한제국", "한성 수도", 240, 1_200, 1_500, 5_800, 17_082_000, 2_400),
  nation("nat_jpn", "일본제국", "도쿄 수도", 760, 3_900, 1_900, 7_000, 43_850_000, 4_600),
  nation("nat_qing", "청제국", "베이징 수도", 1_100, 8_400, 1_200, 4_600, 400_000_000, 1_800),
  nation(
    "nat_rus",
    "러시아제국",
    "상트페테르부르크 수도",
    2_300,
    13_500,
    1_800,
    5_900,
    136_000_000,
    3_900,
  ),
  nation("nat_gbr", "대영제국", "런던 수도", 4_800, 28_000, 2_000, 7_500, 12_300_000, 6_200),
  nation("nat_fra", "프랑스제국", "파리 수도", 2_800, 16_000, 1_900, 6_800, 15_000_000, 5_400),
  nation("nat_deu", "독일제국", "베를린 수도", 3_200, 18_500, 2_100, 7_200, 700_000, 5_800),
  nation("nat_usa", "미합중국", "워싱턴 수도", 5_200, 31_000, 1_600, 8_000, 7_000_000, 6_500),
  nation(
    "nat_nld",
    "네덜란드제국",
    "암스테르담 수도",
    1_600,
    8_200,
    1_800,
    6_500,
    38_000_000,
    4_800,
  ),
  nation("nat_tha", "시암왕국", "방콕 수도", 180, 900, 1_400, 6_200, 8_000_000, 1_600),
]);

export const eastAsiaRelations: readonly RelationDefinition[] = Object.freeze([
  relation("nat_kor", "nat_jpn", -500),
  relation("nat_kor", "nat_qing", 1_000),
  relation("nat_kor", "nat_rus", 250),
  relation("nat_kor", "nat_gbr", 200),
  relation("nat_kor", "nat_usa", 300),
  relation("nat_qing", "nat_rus", 100),
  relation("nat_qing", "nat_jpn", -300),
  relation("nat_qing", "nat_gbr", -200),
  relation("nat_qing", "nat_fra", -150),
  relation("nat_qing", "nat_deu", -100),
  relation("nat_jpn", "nat_rus", -400),
  relation("nat_jpn", "nat_gbr", 400),
  relation("nat_jpn", "nat_usa", 300),
  relation("nat_rus", "nat_gbr", -300),
  relation("nat_rus", "nat_jpn", -400),
  relation("nat_gbr", "nat_fra", 200),
  relation("nat_gbr", "nat_nld", 300),
  relation("nat_gbr", "nat_tha", 100),
  relation("nat_fra", "nat_tha", -200),
  relation("nat_usa", "nat_nld", 200),
]);
