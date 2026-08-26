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
  const [selectedUnitId, setSelectedUnitId] = useState("latest");
  const [moveProvinceId, setMoveProvinceId] = useState("prv_rus_primorye");
  const latestUnit = useMemo(() => [...campaign.units].reverse()[0], [campaign.units]);
  const selectedUnit =
    selectedUnitId === "latest"
      ? latestUnit
      : campaign.units.find((unit) => unit.id === selectedUnitId);
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
            value={selectedUnitId}
            onChange={(event) => setSelectedUnitId(event.target.value)}
          >
            <option value="latest">최근 모집 병력</option>
            {campaign.units.map((unit) => (
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
            value={moveProvinceId}
            onChange={(event) => setMoveProvinceId(event.target.value)}
          >
            {campaign.provinces.map((province) => (
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
        disabled={busy || selectedUnit === undefined}
        onClick={() => {
          if (selectedUnit !== undefined) {
            void onMove(selectedUnit.id, moveProvinceId);
          }
        }}
      >
        병력 이동
      </button>
      <button
        className="primary_button"
        data-testid="resolve-combat"
        type="button"
        disabled={busy || selectedUnit === undefined}
        onClick={() => void onCombat()}
      >
        전투 해결
      </button>
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
