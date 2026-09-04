import type { Campaign } from "../../state/campaign-store";
import { ResolutionDeltaGroups, ResolutionFailures } from "./ResolutionDeltaGroups";

interface ResolutionFeedProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
}

const ResolutionDetails = ({
  resolution,
  playerNationId,
  plan,
  nationNameById,
}: {
  readonly resolution: Campaign["resolutions"][number];
  readonly playerNationId: string;
  readonly plan: Campaign["lastPlan"];
  readonly nationNameById: ReadonlyMap<string, string>;
}): JSX.Element => (
  <article className="resolution_entry" data-testid="resolution-entry">
    <div className="resolution_timestamp" data-testid="resolution-timestamp">
      {resolution.timestampKo}
    </div>
    <strong>{resolution.article.headlineKo}</strong>
    <p className="resolution_lede">{resolution.article.ledeKo}</p>
    <ResolutionDeltaGroups
      resolution={resolution}
      playerNationId={playerNationId}
      nationNameById={nationNameById}
    />
    <ResolutionFailures plan={plan} />
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
          playerNationId={campaign.playerNationId}
          plan={campaign.lastPlan}
          nationNameById={nationNameById}
        />
      )}
    </section>
  );
};
