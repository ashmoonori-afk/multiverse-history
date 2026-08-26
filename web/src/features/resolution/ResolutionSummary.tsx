import type { Campaign } from "../../state/campaign-store";

interface ResolutionSummaryProps {
  readonly campaign: Campaign;
}

const integerFormatter = new Intl.NumberFormat("ko-KR");

const formatInteger = (value: number): string => integerFormatter.format(value);

export const ResolutionSummary = ({ campaign }: ResolutionSummaryProps): JSX.Element => {
  const resolution = campaign.resolutions[campaign.resolutions.length - 1];
  const playerDelta = resolution?.nationDeltas.find(
    (delta) => delta.nationId === campaign.playerNationId,
  );
  const relationDelta = resolution?.relationDeltas[0];
  const treaty = resolution?.treatyDeltas[0];

  return (
    <section className="resolution_summary" data-testid="resolution-summary" aria-live="polite">
      <span className="eyebrow">최근 확정 결과</span>
      {resolution === undefined ? (
        <span>첫 명령을 확정하면 전후 변화가 이곳에 표시됩니다.</span>
      ) : (
        <>
          <strong>{resolution.timestampKo}</strong>
          <span>
            국고 {formatInteger(playerDelta?.treasuryCredits.before ?? 0)} →{" "}
            {formatInteger(playerDelta?.treasuryCredits.after ?? 0)} · 경제{" "}
            {formatInteger(playerDelta?.infrastructureBps.before ?? 0)} →{" "}
            {formatInteger(playerDelta?.infrastructureBps.after ?? 0)}
          </span>
          <span>
            관계 {relationDelta?.before ?? 0} → {relationDelta?.after ?? 0} · 협정{" "}
            {treaty?.clauses[0] === "trade" ? "통상" : "없음"}
          </span>
        </>
      )}
    </section>
  );
};
