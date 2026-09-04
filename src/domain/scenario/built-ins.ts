import { validateScenarioPackageMetadata } from "./metadata";
import type { ScenarioPackageMetadata } from "./types";

const originalSource = ["Public-domain historical facts; independently authored scenario"];
const originalAssets = [
  "Original generated geometry and deterministic neutral fallbacks",
  "Historical boundaries fetched from aourednik/historical-basemaps (GPL-3.0)",
];

interface BuiltInScenarioMetadata extends ScenarioPackageMetadata {
  readonly personaKo: string;
  readonly historicalBaselineKo: string;
}

const builtIn = (
  id: string,
  titleKo: string,
  era: string,
  genre: string,
  year: number,
  personaKo: string,
  historicalBaselineKo: string,
): BuiltInScenarioMetadata =>
  Object.freeze({
    ...validateScenarioPackageMetadata({
      schema: "multiverse-history-scenario/1",
      id,
      titleKo,
      era,
      genre,
      year,
      licenseSpdx: "CC0-1.0",
      authors: ["Multiverse History Team"],
      sourceManifest: originalSource,
      assetManifest: originalAssets,
    }),
    personaKo,
    historicalBaselineKo,
  });

const builtInScenarios = Object.freeze([
  builtIn(
    "scn_bronze_1200bc",
    "청동기 붕괴",
    "ancient",
    "historical",
    -1200,
    "당신은 청동기 세계의 붕괴를 왕실 점토판에 기록하는 궁정 서기관이다.",
    "동지중해의 교역망과 여러 궁전 국가가 전쟁·기근·이주로 연쇄 붕괴하던 시대다.",
  ),
  builtIn(
    "scn_classical_117",
    "제국의 절정",
    "classical",
    "historical",
    117,
    "당신은 대제국들의 흥망을 두루 기록하는 고전 시대의 연대기 작가다.",
    "로마 제국은 최대 영토에 이르렀고 한 제국과 파르티아·쿠샨이 유라시아 교역로를 나눠 지배했다.",
  ),
  builtIn(
    "scn_medieval_1200",
    "실크로드의 세계",
    "medieval",
    "historical",
    1200,
    "당신은 실크로드를 오가며 왕조와 도시의 소식을 남기는 중세 여행 사관이다.",
    "송·금과 이슬람권·유럽 왕국이 교역하던 가운데 몽골 초원의 통합이 시작되고 있었다.",
  ),
  builtIn(
    "scn_steppe_1300",
    "초원의 세기",
    "steppe",
    "nomadic",
    1300,
    "당신은 칸의 궁정에서 초원과 정착 세계의 변화를 기록하는 비서관이다.",
    "몽골 제국의 후계 칸국들이 유라시아를 잇고 경쟁했으며 교역로와 조공 질서가 재편되었다.",
  ),
  builtIn(
    "scn_trade_1650",
    "대항해와 교역",
    "early-modern",
    "economic",
    1650,
    "당신은 항구와 궁정을 오가며 세계 교역을 기록하는 해양 시대의 통상 사관이다.",
    "대서양과 인도양의 해상 교역이 팽창하고 유럽 상업 제국과 아시아 왕조가 시장을 다투었다.",
  ),
  builtIn(
    "scn_ea1900",
    "1900 동아시아",
    "industrial",
    "historical",
    1900,
    "당신은 1900년 동아시아의 역사를 기록하는 제국 사관(史官)이다.",
    "열강의 제국주의 경쟁 속에서 대한제국·청·일본·러시아가 한반도와 만주의 주도권을 다투었다.",
  ),
  builtIn(
    "scn_world_1939",
    "세계대전의 문턱",
    "world-war",
    "historical",
    1939,
    "당신은 제2차 세계대전 전야의 종군 기자다.",
    "유럽과 아시아에서 추축국의 팽창으로 전면전의 위기가 고조되었다.",
  ),
  builtIn(
    "scn_coldwar_1962",
    "냉전의 균형",
    "cold-war",
    "alternate-history",
    1962,
    "당신은 핵전쟁의 문턱에서 각국의 판단을 기록하는 냉전 위기 분석관이다.",
    "미국과 소련의 핵 대치가 절정에 이르렀고 탈식민 신생국들은 양 진영 사이에서 진로를 모색했다.",
  ),
  builtIn(
    "scn_modern",
    "오늘의 세계",
    "modern",
    "contemporary",
    2026,
    "당신은 상호 연결된 현대 세계의 변화를 기록하는 국제 정세 분석관이다.",
    "다극화 경쟁과 기후·기술·공급망 문제가 외교와 안보를 동시에 흔드는 시대다.",
  ),
  builtIn(
    "scn_reconstruction_2281",
    "재건기 2281",
    "future",
    "science-fiction",
    2281,
    "당신은 재건 평의회 기록관이다.",
    "대붕괴 이후 살아남은 공동체들이 단절된 세계망을 복구하며 새로운 국가 질서를 세우고 있다.",
  ),
]);

export const listBuiltInScenarioMetadata = (): readonly BuiltInScenarioMetadata[] =>
  builtInScenarios;
