import { useMemo, useState } from "react";

import type { Campaign } from "../../state/campaign-store";

const provinceLabelsKo: Readonly<Record<string, string>> = {
  prv_kor_hanseong: "한성",
  prv_kor_gyeonggi: "경기",
  prv_kor_pyeongan: "평안",
  prv_jpn_kanto: "간토",
  prv_qing_zhili: "직례",
  prv_rus_primorye: "연해주",
};

const provinceNameKo = (provinceId: string): string => provinceLabelsKo[provinceId] ?? provinceId;

interface MilitaryPanelProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly busy: boolean;
  readonly onRecruit: (provinceId: string) => Promise<boolean>;
  readonly onMove: (unitId: string, provinceId: string) => Promise<boolean>;
  readonly onCombat: () => Promise<boolean>;
}

export const MilitaryPanel = ({
  campaign,
  nationNameById,
  busy,
  onRecruit,
  onMove,
  onCombat,
}: MilitaryPanelProps): JSX.Element => {
  const playerProvinces = campaign.provinces.filter(
    (province) => province.ownerNationId === campaign.playerNationId,
  );
  const [recruitProvinceId, setRecruitProvinceId] = useState(playerProvinces[0]?.id ?? "");
  const playerUnits = useMemo(
    () => campaign.units.filter((unit) => unit.ownerNationId === campaign.playerNationId),
    [campaign.playerNationId, campaign.units],
  );
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [moveProvinceId, setMoveProvinceId] = useState("");
  const selectedUnit = playerUnits.find((unit) => unit.id === selectedUnitId) ?? playerUnits.at(-1);
  const selectedProvince = campaign.provinces.find(
    (province) => province.id === selectedUnit?.provinceId,
  );
  const legalDestinations = campaign.provinces.filter((province) =>
    (selectedProvince?.adjacentProvinceIds ?? []).includes(province.id),
  );
  const legalMoveProvinceId = legalDestinations.some((province) => province.id === moveProvinceId)
    ? moveProvinceId
    : (legalDestinations[0]?.id ?? "");
  const activeWars = campaign.wars.filter(
    (war) =>
      war.status === "active" &&
      [war.attackerNationId, war.targetNationId].includes(campaign.playerNationId),
  );
  const latestBattle = [...campaign.battleReports].reverse()[0];
  const controlProvince = campaign.provinces.find(
    (province) => province.id === selectedUnit?.provinceId,
  );

  return (
    <section className="panel_section military_panel" data-testid="military-panel">
      <div className="military_panel_heading">
        <div>
          <span className="eyebrow">군사 지휘</span>
          <h3>병력과 전투</h3>
        </div>
        <span className="status_pill">결정 전</span>
      </div>
      <div className="military_action_grid">
        <label className="field">
          <span>모집 지역</span>
          <select
            data-testid="recruit-province"
            value={recruitProvinceId}
            onChange={(event) => setRecruitProvinceId(event.target.value)}
          >
            {playerProvinces.map((province) => (
              <option key={province.id} value={province.id}>
                {provinceNameKo(province.id)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary_button"
          data-testid="recruit-unit"
          type="button"
          disabled={busy || recruitProvinceId.length === 0}
          onClick={() => void onRecruit(recruitProvinceId)}
        >
          병력 모집
        </button>
      </div>
      <div className="military_action_grid">
        <label className="field">
          <span>이동 병력</span>
          <select
            data-testid="unit-select"
            value={selectedUnit?.id ?? ""}
            onChange={(event) => setSelectedUnitId(event.target.value)}
          >
            {playerUnits.length === 0 ? <option value="">병력 없음</option> : null}
            {playerUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.id} · {unit.manpower}명
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>이동 지역</span>
          <select
            data-testid="move-province"
            value={legalMoveProvinceId}
            onChange={(event) => setMoveProvinceId(event.target.value)}
          >
            {legalDestinations.length === 0 ? <option value="">인접 이동지 없음</option> : null}
            {legalDestinations.map((province) => (
              <option key={province.id} value={province.id}>
                {provinceNameKo(province.id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="secondary_button"
        data-testid="move-unit"
        type="button"
        disabled={busy || selectedUnit === undefined || legalMoveProvinceId.length === 0}
        onClick={() => {
          if (selectedUnit !== undefined) {
            void onMove(selectedUnit.id, legalMoveProvinceId);
          }
        }}
      >
        병력 이동
      </button>
      <button
        className="primary_button"
        data-testid="resolve-combat"
        type="button"
        disabled={busy || activeWars.length === 0}
        onClick={() => void onCombat()}
      >
        전투 해결
      </button>
      <ul className="military_war_list" data-testid="military-war-list">
        {activeWars.length === 0 ? (
          <li>진행 중인 전쟁이 없습니다.</li>
        ) : (
          activeWars.map((war) => {
            const counterpartId =
              war.attackerNationId === campaign.playerNationId
                ? war.targetNationId
                : war.attackerNationId;
            return (
              <li key={war.id}>
                전쟁 중 · {nationNameById.get(counterpartId) ?? counterpartId} · 턴{" "}
                {war.declaredTurn}
              </li>
            );
          })
        )}
      </ul>
      <p className="battle_report" data-testid="battle-report" role="status">
        {latestBattle ?? "전투 결과가 아직 없습니다."}
      </p>
      <p className="province_control" data-testid="province-control">
        {controlProvince === undefined
          ? "이동한 병력이 전투 지역을 선택합니다."
          : `${provinceNameKo(controlProvince.id)} 통제: ${nationNameById.get(controlProvince.ownerNationId) ?? controlProvince.ownerNationId}`}
      </p>
    </section>
  );
};
