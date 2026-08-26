import type { Campaign } from "../../state/campaign-store";

interface NationPanelProps {
  readonly campaign: Campaign;
  readonly selectedNationId: string;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly onSelectNation: (nationId: string) => void;
}

const formatInteger = (value: number): string => new Intl.NumberFormat("ko-KR").format(value);
const formatRelation = (value: number): string => (value > 0 ? `+${value}` : String(value));

export const NationPanel = ({
  campaign,
  selectedNationId,
  nationNameById,
  onSelectNation,
}: NationPanelProps): JSX.Element => {
  const selectedNation =
    campaign.nations.find((nation) => nation.id === selectedNationId) ??
    campaign.nations.find((nation) => nation.id === campaign.playerNationId);
  const ownedProvinceCount = campaign.provinces.filter(
    (province) => province.ownerNationId === selectedNation?.id,
  ).length;
  const selectedRelation =
    campaign.relations.find(
      (relation) =>
        relation.fromNationId === campaign.playerNationId &&
        relation.toNationId === selectedNation?.id,
    )?.value ?? 0;

  if (selectedNation === undefined) {
    return <p className="panel_section p">선택 가능한 국가가 없습니다.</p>;
  }

  return (
    <>
      <section className="nation_directory" aria-labelledby="nation-directory-title">
        <h4 id="nation-directory-title">국가 선택</h4>
        <ul className="nation_directory_list">
          {campaign.nations.map((nation) => (
            <li key={nation.id}>
              <button
                className="nation_option"
                type="button"
                aria-pressed={nation.id === selectedNation.id}
                data-testid={`nation-option-${nation.id}`}
                onClick={() => onSelectNation(nation.id)}
              >
                <span>{nation.nameKo}</span>
                <span className="province_owner">
                  {nation.id === campaign.playerNationId ? "플레이어" : "국가"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section
        className="selected_nation_panel"
        data-testid="selected-nation-panel"
        data-nation-id={selectedNation.id}
      >
        <div className="selected_nation_heading">
          <div>
            <span className="eyebrow">선택 국가</span>
            <h4>{selectedNation.nameKo}</h4>
          </div>
          <span className="status_pill">
            {selectedNation.id === campaign.playerNationId ? "플레이어" : "관찰"}
          </span>
        </div>
        <div className="selected_nation_metrics">
          <dl className="selected_nation_metric">
            <dt>소유 지역</dt>
            <dd data-testid="selected-nation-owned">{ownedProvinceCount}</dd>
          </dl>
          <dl className="selected_nation_metric">
            <dt>대한제국 관계</dt>
            <dd data-testid="selected-nation-relation">{formatRelation(selectedRelation)}</dd>
          </dl>
          <dl className="selected_nation_metric">
            <dt>국고</dt>
            <dd>{formatInteger(selectedNation.treasuryCredits)}</dd>
          </dl>
          <dl className="selected_nation_metric">
            <dt>인구</dt>
            <dd>{formatInteger(selectedNation.population)}</dd>
          </dl>
        </div>
        <p>
          {nationNameById.get(selectedNation.id) ?? selectedNation.id}의 경제·영토 상태를
          확인합니다.
        </p>
      </section>
    </>
  );
};
