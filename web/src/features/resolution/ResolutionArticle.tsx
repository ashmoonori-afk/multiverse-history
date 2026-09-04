import type {
  CampaignResolution,
  StrategicPlan,
  TimelineCadence,
} from "../../state/campaign-store";
import { ResolutionDeltaGroups, ResolutionFailures } from "./ResolutionDeltaGroups";
import { ResolutionWorldFeedback } from "./ResolutionWorldFeedback";
import "./campaign-result.css";
import "./processed-news.css";

interface ResolutionArticleProps {
  readonly resolution: CampaignResolution;
  readonly playerNationId: string;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly plan?: StrategicPlan | null;
  readonly headingLevel?: 2 | 5;
}

const integerFormatter = new Intl.NumberFormat("ko-KR");
const MAX_COUNTRY_CHIPS = 5;

const cadenceLabels: Readonly<Record<TimelineCadence, string>> = Object.freeze({
  week: "1주",
  month: "1개월",
  quarter: "1분기",
  year: "1년",
  major: "다음 주요 사건까지",
});

const formatInteger = (value: number): string => integerFormatter.format(value);

export const ResolutionArticle = ({
  resolution,
  playerNationId,
  nationNameById,
  plan = null,
  headingLevel = 2,
}: ResolutionArticleProps): JSX.Element => {
  const playerDelta = resolution.nationDeltas.find((delta) => delta.nationId === playerNationId);
  const affectedNationIds = resolution.worldImpact.changedNationIds.slice(0, MAX_COUNTRY_CHIPS);
  const hiddenNationCount =
    resolution.worldImpact.changedNationIds.length - affectedNationIds.length;
  const Headline = headingLevel === 5 ? "h5" : "h2";

  return (
    <article
      className="resolution_article"
      data-testid={headingLevel === 5 ? "timeline-news-article" : "resolution-article"}
    >
      <header className="resolution_article_header">
        <span className="eyebrow">가변 역사 속보</span>
        <Headline className="resolution_article_title" data-testid="resolution-article-headline">
          {resolution.article.headlineKo}
        </Headline>
      </header>

      <div className="resolution_choice">
        <span>당신이 선택한 행동 · 경과 {formatInteger(resolution.advanceDays)}일</span>
        <strong data-testid="resolution-order">{resolution.orderText}</strong>
      </div>

      <ResolutionDeltaGroups
        resolution={resolution}
        playerNationId={playerNationId}
        nationNameById={nationNameById}
      />

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
        {affectedNationIds.map((nationId) => (
          <li key={nationId}>{nationNameById.get(nationId) ?? nationId}</li>
        ))}
        {hiddenNationCount > 0 ? (
          <li aria-label={`추가 영향 국가 ${hiddenNationCount}개`}>+{hiddenNationCount}개국</li>
        ) : null}
        {resolution.treatyDeltas.length > 0 ? <li>외교</li> : null}
        {playerDelta?.infrastructureBps.before === playerDelta?.infrastructureBps.after ? null : (
          <li>경제</li>
        )}
      </ul>

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
      <ResolutionFailures plan={plan} />

      <ResolutionWorldFeedback resolution={resolution} nationNameById={nationNameById} />

      <details className="resolution_map_disclosure">
        <summary data-testid="resolution-map-impact">지도 변경 보기</summary>
        <p data-testid="resolution-world-impact">{resolution.worldImpact.summaryKo}</p>
      </details>
    </article>
  );
};
