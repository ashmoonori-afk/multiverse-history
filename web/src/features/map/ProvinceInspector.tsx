import type { Campaign } from "../../state/campaign-store";
import { eastAsiaProvinceById, type TerrainKind } from "./east-asia-map";

interface ProvinceInspectorProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly selectedProvinceId: string | null;
}

const terrainLabel: Readonly<Record<TerrainKind, string>> = {
  mountain: "산악",
  forest: "삼림",
  plain: "평야",
  coast: "연안",
};

export const ProvinceInspector = ({
  campaign,
  nationNameById,
  selectedProvinceId,
}: ProvinceInspectorProps): JSX.Element => {
  const feature =
    selectedProvinceId === null ? undefined : eastAsiaProvinceById.get(selectedProvinceId);
  const province = campaign.provinces.find((candidate) => candidate.id === selectedProvinceId);

  if (feature === undefined || province === undefined) {
    return (
      <section className="province_inspector is_empty" data-testid="province-inspector">
        <span className="eyebrow">지역 검사</span>
        <h3>지역을 선택하세요</h3>
        <p>지도에서 지역을 클릭하면 지형, 소유권, 인구와 인접 지역을 확인할 수 있습니다.</p>
      </section>
    );
  }

  const ownerName = nationNameById.get(province.ownerNationId) ?? province.ownerNationId;
  const unitCount = campaign.units.filter((unit) => unit.provinceId === province.id).length;
  const isChanged =
    campaign.resolutions.at(-1)?.worldImpact.changedProvinceIds.includes(province.id) ?? false;
  const neighborNames = feature.neighbors.map(
    (neighborId) =>
      eastAsiaProvinceById.get(neighborId)?.labelKo ??
      neighborId.replace(/^prv_/, "").replaceAll("_", " "),
  );

  return (
    <section className="province_inspector" data-testid="province-inspector">
      <div className="province_inspector_heading">
        <div>
          <span className="eyebrow">선택 지역</span>
          <h3>{feature.labelKo}</h3>
        </div>
        <span className={`province_status ${isChanged ? "is_changed" : ""}`}>
          {isChanged ? "최근 변화" : terrainLabel[feature.terrain]}
        </span>
      </div>
      <p className="province_inspector_owner">
        {ownerName} · {terrainLabel[feature.terrain]}
      </p>
      <dl className="province_detail_grid">
        <div>
          <dt>인구</dt>
          <dd>{province.population.toLocaleString("ko-KR")}</dd>
        </div>
        <div>
          <dt>주둔 부대</dt>
          <dd>{unitCount}개</dd>
        </div>
        <div>
          <dt>지형 효과</dt>
          <dd>
            {feature.terrain === "mountain"
              ? "방어 우세"
              : feature.terrain === "coast"
                ? "항로 연결"
                : feature.terrain === "forest"
                  ? "보급 은폐"
                  : "이동 용이"}
          </dd>
        </div>
        <div>
          <dt>지역 ID</dt>
          <dd className="province_detail_code">{province.id}</dd>
        </div>
      </dl>
      <p className="province_neighbors">
        인접: {neighborNames.length > 0 ? neighborNames.join(" · ") : "기록 없음"}
      </p>
    </section>
  );
};
