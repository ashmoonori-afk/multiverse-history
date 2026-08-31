import { z } from "zod";

import type { CampaignResolutionDraft } from "./campaign-resolution";

export interface CampaignNewsQuote {
  readonly textKo: string;
  readonly attributionKo: string;
}

export interface CampaignNewsArticle {
  readonly headlineKo: string;
  readonly ledeKo: string;
  readonly paragraphsKo: readonly string[];
  readonly quote?: CampaignNewsQuote | undefined;
}

export const CampaignNewsArticleSchema = z
  .object({
    headlineKo: z.string().min(1),
    ledeKo: z.string().min(1),
    paragraphsKo: z.array(z.string().min(1)).min(2),
    quote: z
      .object({
        textKo: z.string().min(1),
        attributionKo: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

const formatInteger = (value: number): string => new Intl.NumberFormat("ko-KR").format(value);

const directionParticle = (value: number): "로" | "으로" => {
  const lastDigit = Math.abs(Math.trunc(value)) % 10;
  return lastDigit === 0 || lastDigit === 3 || lastDigit === 6 ? "으로" : "로";
};

const headline = (
  draft: CampaignResolutionDraft,
  nationNameById: ReadonlyMap<string, string>,
): string => {
  const playerDelta = draft.nationDeltas[0];
  const treatyDelta = draft.treatyDeltas[0];
  const playerName = playerDelta?.nationNameKo ?? "정부";
  const treatyTarget =
    treatyDelta === undefined
      ? undefined
      : (nationNameById.get(treatyDelta.recipientNationId) ?? treatyDelta.recipientNationId);
  const infrastructureRaised =
    playerDelta !== undefined &&
    playerDelta.infrastructureBps.after > playerDelta.infrastructureBps.before;

  if (infrastructureRaised && treatyTarget !== undefined) {
    return `${playerName}, 철도망 확장과 ${treatyTarget} 통상 협상 착수`;
  }
  if (treatyTarget !== undefined) {
    return `${playerName}, ${treatyTarget}에 통상 협정 제안`;
  }
  if (infrastructureRaised) {
    return `${playerName}, 국가 철도망 확장 사업 착수`;
  }
  return `${playerName}, 새 국가 방침 공식 확정`;
};

export const createCampaignNewsArticle = (
  draft: CampaignResolutionDraft,
  nationNameById: ReadonlyMap<string, string>,
): CampaignNewsArticle => {
  const playerDelta = draft.nationDeltas[0];
  const relationDelta = draft.relationDeltas[0];
  const economyParagraph =
    playerDelta === undefined
      ? "즉시 집계된 국내 경제 지표에는 유의미한 변동이 없었다."
      : `${playerDelta.nationNameKo}의 국고는 ${formatInteger(playerDelta.treasuryCredits.before)}에서 ${formatInteger(playerDelta.treasuryCredits.after)}${directionParticle(playerDelta.treasuryCredits.after)} 조정됐다. 기반시설 지수는 ${formatInteger(playerDelta.infrastructureBps.before)}에서 ${formatInteger(playerDelta.infrastructureBps.after)}${directionParticle(playerDelta.infrastructureBps.after)} 상승했다.`;
  const diplomacyParagraph =
    relationDelta === undefined
      ? "직접 확인된 양자 관계 변화는 없었으며 추가 외교 대응은 다음 보고로 넘어갔다."
      : `관련국과의 관계 지수는 ${formatInteger(relationDelta.before)}에서 ${formatInteger(relationDelta.after)}${directionParticle(relationDelta.after)} 변했다. ${draft.treatyDeltas.length > 0 ? "통상 협정 제안은 상대국 외교 채널에 공식 접수됐다." : "후속 협의 필요성이 커졌다."}`;
  const playerName = playerDelta?.nationNameKo ?? "정부";
  const quoteTextKo =
    draft.treatyDeltas.length > 0
      ? "철도 기반과 대외 교역을 함께 강화해 장기적인 성장 여건을 마련하겠다"
      : "이번 정책의 성과를 지표로 확인하고 다음 조치를 결정하겠다";
  return Object.freeze({
    headlineKo: headline(draft, nationNameById),
    ledeKo: `확정된 정책 조치가 ${formatInteger(draft.advanceDays)}일간의 집행 검토를 거쳐 공식 발표됐다.`,
    paragraphsKo: Object.freeze([economyParagraph, diplomacyParagraph]),
    quote: Object.freeze({
      textKo: quoteTextKo,
      attributionKo: `${playerName} 정부 발표`,
    }),
  });
};

export const campaignNewsArticleBody = (article: CampaignNewsArticle): string =>
  [article.ledeKo, ...article.paragraphsKo].join(" ");
