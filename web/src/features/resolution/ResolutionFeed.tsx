import type { Campaign } from "../../state/campaign-store";

interface ResolutionFeedProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
}

const integerFormatter = new Intl.NumberFormat("ko-KR");

const formatNumber = (value: number): string => integerFormatter.format(value);

const formatClause = (clause: string): string => {
  switch (clause) {
    case "trade":
      return "통상";
    case "alliance":
      return "동맹";
    case "non_aggression":
      return "불가침";
    case "military_access":
      return "군사 통행";
    default:
      return clause;
  }
};

const formatSigned = (value: number): string => (value > 0 ? `+${value}` : String(value));

interface ResolutionDeltasProps {
  readonly resolution: Campaign["resolutions"][number];
  readonly playerDelta: Campaign["resolutions"][number]["nationDeltas"][number] | undefined;
  readonly relationDelta: Campaign["resolutions"][number]["relationDeltas"][number] | undefined;
  readonly nationNameById: ReadonlyMap<string, string>;
}

const ResolutionDeltas = ({
  resolution,
  playerDelta,
  relationDelta,
  nationNameById,
}: ResolutionDeltasProps): JSX.Element => {
  const relationText =
    relationDelta === undefined
      ? "변화 없음"
      : `${nationNameById.get(relationDelta.toNationId) ?? relationDelta.toNationId} ${formatSigned(relationDelta.before)} → ${formatSigned(relationDelta.after)}`;
  const treatyText =
    resolution.treatyDeltas.length === 0
      ? "새 협정 없음"
      : resolution.treatyDeltas
          .map(
            (treaty) =>
              `${nationNameById.get(treaty.recipientNationId) ?? treaty.recipientNationId} · ${treaty.clauses.map(formatClause).join(", ")}`,
          )
          .join(" / ");
  return (
    <ul className="resolution_delta_list">
      <li data-testid="resolution-delta-treasury">
        <span>국고</span>
        <strong>
          {formatNumber(playerDelta?.treasuryCredits.before ?? 0)} →{" "}
          {formatNumber(playerDelta?.treasuryCredits.after ?? 0)}
        </strong>
      </li>
      <li data-testid="resolution-delta-economy">
        <span>경제 기반시설</span>
        <strong>
          {formatNumber(playerDelta?.infrastructureBps.before ?? 0)} →{" "}
          {formatNumber(playerDelta?.infrastructureBps.after ?? 0)}
        </strong>
      </li>
      <li data-testid="resolution-delta-relation">
        <span>관계</span>
        <strong>{relationText}</strong>
      </li>
      <li data-testid="resolution-delta-treaty">
        <span>협정</span>
        <strong>{treatyText}</strong>
      </li>
    </ul>
  );
};

const ResolutionDetails = ({
  resolution,
  playerDelta,
  relationDelta,
  nationNameById,
}: ResolutionDeltasProps): JSX.Element => (
  <article className="resolution_entry" data-testid="resolution-entry">
    <div className="resolution_timestamp" data-testid="resolution-timestamp">
      {resolution.timestampKo}
    </div>
    <strong>{resolution.article.headlineKo}</strong>
    <p className="resolution_lede">{resolution.article.ledeKo}</p>
    <ResolutionDeltas
      resolution={resolution}
      playerDelta={playerDelta}
      relationDelta={relationDelta}
      nationNameById={nationNameById}
    />
    <div className="resolution_world_impact" data-testid="resolution-world-impact">
      <strong>지도 영향</strong>
      <span>{resolution.worldImpact.summaryKo}</span>
      <span>
        국가 {resolution.worldImpact.changedNationIds.length}곳 · 지역{" "}
        {resolution.worldImpact.changedProvinceIds.join(", ")}
      </span>
    </div>
  </article>
);

export const ResolutionFeed = ({ campaign, nationNameById }: ResolutionFeedProps): JSX.Element => {
  const resolution = campaign.resolutions[campaign.resolutions.length - 1];
  const playerDelta = resolution?.nationDeltas.find(
    (delta) => delta.nationId === campaign.playerNationId,
  );
  const relationDelta = resolution?.relationDeltas[0];

  return (
    <section className="resolution_feed" data-testid="resolution-feed" aria-live="polite">
      <div className="resolution_feed_heading">
        <div>
          <span className="eyebrow">세계 변화</span>
          <h2>결정 결과</h2>
        </div>
        {resolution === undefined ? null : (
          <span className="status_pill">턴 {resolution.turn}</span>
        )}
      </div>
      {resolution === undefined ? (
        <p className="resolution_empty">첫 명령을 확정하면 구체적인 전후 변화가 표시됩니다.</p>
      ) : (
        <ResolutionDetails
          resolution={resolution}
          playerDelta={playerDelta}
          relationDelta={relationDelta}
          nationNameById={nationNameById}
        />
      )}
    </section>
  );
};
