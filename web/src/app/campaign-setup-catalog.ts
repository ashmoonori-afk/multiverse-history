import { z } from "zod";

import type { PresetDraft } from "../features/presets/PresetEditor";

export const defaultScenarioOptions = [
  {
    id: "scn_ea1900",
    titleKo: "1900 동아시아",
    era: "industrial",
    genre: "historical",
    description: "대한제국과 주변 강대국의 산업화와 외교를 지휘합니다.",
    playerNationIds: ["nat_kor", "nat_jpn", "nat_qing", "nat_rus"],
    nations: [
      { id: "nat_kor", titleKo: "대한제국" },
      { id: "nat_jpn", titleKo: "일본제국" },
      { id: "nat_qing", titleKo: "청제국" },
      { id: "nat_rus", titleKo: "러시아제국" },
    ],
  },
];

export const defaultNationOptions = [
  { id: "nat_kor", titleKo: "대한제국" },
  { id: "nat_jpn", titleKo: "일본제국" },
  { id: "nat_qing", titleKo: "청제국" },
  { id: "nat_rus", titleKo: "러시아제국" },
];

export const CatalogSchema = z
  .object({
    scenarios: z.array(
      z
        .object({
          id: z.string(),
          titleKo: z.string(),
          era: z.string(),
          genre: z.string(),
          year: z.number().int(),
          playerNationIds: z.array(z.string()),
          nations: z.array(z.object({ id: z.string(), nameKo: z.string() }).strict()),
        })
        .strict(),
    ),
    countries: z.array(
      z
        .object({
          id: z.string(),
          alpha2: z.string(),
          alpha3: z.string(),
          numericCode: z.string(),
          nameKo: z.string(),
          nameEn: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export const defaultPreset: PresetDraft = {
  schema: "multiverse-history-preset/1",
  scenarioId: "scn_ea1900",
  titleKo: "1900 동아시아",
  era: "industrial",
  genre: "historical",
  year: 1900,
  licenseSpdx: "CC0-1.0",
  authors: ["Multiverse History Team"],
  sourceManifest: ["Public-domain historical facts; independently authored scenario"],
  assetManifest: ["Original generated geometry and deterministic neutral fallbacks"],
  nations: "대한제국, 일본제국, 청제국, 러시아제국",
  regions: "한반도, 일본 열도, 만주, 연해주",
  geography: "동아시아의 산맥과 해안선을 기반으로 한 1900년 지도",
  rules: "외교, 경제, 군사 행동은 턴 단위로 처리합니다.",
  history: "1900년 동아시아의 산업화와 제국 간 경쟁을 출발점으로 합니다.",
  brainstormPrompt: "새로운 역사적 분기와 세력의 선택지를 제안하세요.",
  polishPrompt: "시나리오 설명을 간결하고 일관된 문장으로 다듬으세요.",
};
