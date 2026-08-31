import type { CampaignResolution, TimelineCadence } from "../../state/campaign-store";
import { ResolutionWorldFeedback } from "./ResolutionWorldFeedback";
import "./campaign-result.css";
import "./processed-news.css";

interface ResolutionArticleProps {
  readonly resolution: CampaignResolution;
  readonly playerNationId: string;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly headingLevel?: 2 | 5;
}

const integerFormatter = new Intl.NumberFormat("ko-KR");

const cadenceLabels: Readonly<Record<TimelineCadence, string>> = Object.freeze({
  week: "1주",
  month: "1개월",
  quarter: "1분기",
  year: "1년",
  major: "다음 주요 사건까지",
});

const formatInteger = (value: number): string => integerFormatter.format(value);

const formatChange = (before: number, after: number): string =>
  `${formatInteger(before)} → ${formatInteger(after)}`;

const formatRelation = (
  relation: CampaignResolution["relationDeltas"][number] | undefined,
  nationNameById: ReadonlyMap<string, string>,
): string =>
  relation === undefined
    ? "관계 변화 없음"
    : `${nationNameById.get(relation.toNationId) ?? relation.toNationId} ${formatChange(
        relation.before,
        relation.after,
      )}`;

export const ResolutionArticle = ({
  resolution,
  playerNationId,
  nationNameById,
  headingLevel = 2,
}: ResolutionArticleProps): JSX.Element => {
  const playerDelta = resolution.nationDeltas.find((delta) => delta.nationId === playerNationId);
  const relation = resolution.relationDeltas[0];
  const Headline = headingLevel === 5 ? "h5" : "h2";

  return (
    <article
      className="resolution_article"
      data-testid={headingLevel === 5 ? "timeline-news-article" : "resolution-article"}
    >
      <div className="resolution_article_meta" data-testid="resolution-article-meta">
        <span>{resolution.timestampKo}</span>
        <span className="resolution_article_source">동아시아 역사통신</span>
        <span
          className="resolution_progress"
          data-testid="resolution-progress"
          data-cadence={resolution.cadence}
        >
          {cadenceLabels[resolution.cadence]} 진행
        </span>
      </div>
      <ul
        className="resolution_tags"
        data-testid="resolution-article-actors"
        aria-label="영향을 받은 국가와 기사 주제"
      >
        {resolution.worldImpact.changedNationIds.map((nationId) => (
          <li key={nationId}>{nationNameById.get(nationId) ?? nationId}</li>
        ))}
        {resolution.treatyDeltas.length > 0 ? <li>외교</li> : null}
        {playerDelta?.infrastructureBps.before === playerDelta?.infrastructureBps.after ? null : (
          <li>경제</li>
        )}
      </ul>
      <header className="resolution_article_header">
        <span className="eyebrow">가변 역사 속보</span>
        <Headline className="resolution_article_title" data-testid="resolution-article-headline">
          {resolution.article.headlineKo}
        </Headline>
      </header>

      <section className="resolution_article_body" data-testid="resolution-article-body">
        <p className="resolution_article_lede">{resolution.article.ledeKo}</p>
        {resolution.article.paragraphsKo.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      {resolution.article.quote === undefined ? null : (
        <blockquote className="resolution_article_quote">
          <span>“{resolution.article.quote.textKo}”</span>
          <cite>— {resolution.article.quote.attributionKo}</cite>
        </blockquote>
      )}

      <div className="resolution_choice">
        <span>당신이 선택한 행동 · 경과 {formatInteger(resolution.advanceDays)}일</span>
        <strong data-testid="resolution-order">{resolution.orderText}</strong>
      </div>

      <section
        className="resolution_before_after"
        data-testid="resolution-before-after"
        aria-labelledby={`change-${resolution.id}`}
      >
        <h3 id={`change-${resolution.id}`}>이 행동이 바꾼 역사</h3>
        <dl>
          <div>
            <dt>국고</dt>
            <dd>
              {formatChange(
                playerDelta?.treasuryCredits.before ?? 0,
                playerDelta?.treasuryCredits.after ?? 0,
              )}
            </dd>
          </div>
          <div>
            <dt>기반시설</dt>
            <dd>
              {formatChange(
                playerDelta?.infrastructureBps.before ?? 0,
                playerDelta?.infrastructureBps.after ?? 0,
              )}
            </dd>
          </div>
          <div>
            <dt>국내총생산</dt>
            <dd>
              {formatChange(
                playerDelta?.gdpCredits.before ?? 0,
                playerDelta?.gdpCredits.after ?? 0,
              )}
            </dd>
          </div>
          <div>
            <dt>외교 관계</dt>
            <dd>{formatRelation(relation, nationNameById)}</dd>
          </div>
        </dl>
      </section>

      <ResolutionWorldFeedback resolution={resolution} nationNameById={nationNameById} />

      <details className="resolution_map_disclosure">
        <summary data-testid="resolution-map-impact">지도 변경 보기</summary>
        <p data-testid="resolution-world-impact">{resolution.worldImpact.summaryKo}</p>
      </details>
    </article>
  );
};
