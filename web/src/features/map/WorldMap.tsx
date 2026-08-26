import type { ComponentType } from "react";
import { useState } from "react";
import {
  ComposableMap,
  type ComposableMapProps,
  Geographies,
  type GeographiesProps,
  Geography,
  type GeographyProps,
} from "react-simple-maps";
import worldAtlas from "world-atlas/countries-110m.json";

import type { Campaign } from "../../state/campaign-store";

interface WorldMapProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly selectedNationId: string;
  readonly onSelectNation: (nationId: string) => void;
}

const TypedComposableMap = ComposableMap as unknown as ComponentType<ComposableMapProps>;
const TypedGeographies = Geographies as unknown as ComponentType<GeographiesProps>;
const TypedGeography = Geography as unknown as ComponentType<GeographyProps>;

const provinceLabelsKo: Readonly<Record<string, string>> = {
  prv_kor_hanseong: "한성",
  prv_kor_gyeonggi: "경기",
  prv_kor_pyeongan: "평안",
  prv_kor_hamgyeong: "함경",
  prv_kor_chungcheong: "충청",
  prv_kor_jeolla: "전라",
  prv_kor_gyeongsang: "경상",
};

const shortProvinceName = (id: string): string =>
  provinceLabelsKo[id] ??
  id
    .replace(/^prv_/, "")
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const factionPalette = ["#39c6a0", "#e7b85b", "#e27669", "#76a7df", "#bd8de4", "#e29259"];

const factionForGeography = (
  geographyName: string,
  nationIds: readonly string[],
): string | undefined => {
  if (nationIds.length === 0) {
    return undefined;
  }
  const normalizedName = geographyName.toLowerCase();
  const preferredNationId =
    normalizedName.includes("korea") || normalizedName.includes("south korea")
      ? "nat_kor"
      : normalizedName.includes("japan")
        ? "nat_jpn"
        : normalizedName.includes("china")
          ? "nat_qing"
          : normalizedName.includes("russia")
            ? "nat_rus"
            : undefined;
  if (preferredNationId !== undefined && nationIds.includes(preferredNationId)) {
    return preferredNationId;
  }
  const hash = [...geographyName].reduce((total, character) => total + character.charCodeAt(0), 0);
  return nationIds[hash % nationIds.length];
};

const geographyLabel = (geography: unknown): string => {
  if (typeof geography !== "object" || geography === null) {
    return "알 수 없는 지역";
  }
  const properties = (geography as { properties?: { name?: unknown } }).properties;
  return typeof properties?.name === "string" ? properties.name : "알 수 없는 지역";
};

export const WorldMap = ({
  campaign,
  nationNameById,
  selectedNationId,
  onSelectNation,
}: WorldMapProps): JSX.Element => (
  <MapSurface
    campaign={campaign}
    nationNameById={nationNameById}
    selectedNationId={selectedNationId}
    onSelectNation={onSelectNation}
  />
);

const MapSurface = ({
  campaign,
  nationNameById,
  selectedNationId,
  onSelectNation,
}: WorldMapProps): JSX.Element => {
  const [mode, setMode] = useState<"political" | "terrain" | "diplomacy" | "economy" | "military">(
    "political",
  );
  const [globeView, setGlobeView] = useState(false);
  const [customRegion, setCustomRegion] = useState("");
  const [customRegions, setCustomRegions] = useState<readonly string[]>([]);
  const ownedProvinces = campaign.provinces.filter(
    (province) => province.ownerNationId === campaign.playerNationId,
  );
  const playerNation = campaign.nations.find((nation) => nation.id === campaign.playerNationId);
  const mapModes = [
    ["political", "정치"],
    ["terrain", "지형"],
    ["diplomacy", "외교"],
    ["economy", "경제"],
    ["military", "군사"],
  ] as const;
  const modeLabels: Readonly<Record<(typeof mapModes)[number][0], string>> = {
    political: "정치",
    terrain: "지형",
    diplomacy: "외교",
    economy: "경제",
    military: "군사",
  };
  const factionEntries = campaign.nations.map((nation, index) => ({
    nation,
    color: factionPalette[index % factionPalette.length] ?? factionPalette[0],
  }));
  const factionById = new Map(factionEntries.map((entry) => [entry.nation.id, entry]));
  const [hoveredFactionId, setHoveredFactionId] = useState<string | null>(null);
  const mapEntities = [
    ...(playerNation === undefined ? [] : [`수도: ${playerNation.capitalLabelKo}`]),
    ...ownedProvinces.map((province) => `도시: ${shortProvinceName(province.id)}`),
    ...(campaign.units.filter((unit) => unit.ownerNationId === campaign.playerNationId).length > 0
      ? campaign.units
          .filter((unit) => unit.ownerNationId === campaign.playerNationId)
          .map((unit) => `대대: ${unit.id}`)
      : ["대대: 편성 대기"]),
    "해협: 대한해협",
    ...customRegions.map((region) => `사용자 지형: ${region}`),
  ];

  return (
    <>
      <section
        className={`map_stage ${globeView ? "is_globe_view" : ""}`}
        aria-labelledby="map-title"
        data-map-mode={mode}
      >
        <div className="map_header">
          <div>
            <h1 id="map-title">{globeView ? "세계 지구본 보기" : `${modeLabels[mode]} 지도`}</h1>
            <p>
              {nationNameById.get(campaign.playerNationId) ?? campaign.playerNationId} 통제 지역{" "}
              {
                campaign.provinces.filter(
                  (province) => province.ownerNationId === campaign.playerNationId,
                ).length
              }
              곳 · 아래로 스크롤
            </p>
          </div>
          <label className="map_nation_picker">
            <span className="visually_hidden">지도 국가 선택</span>
            <select
              data-testid="map-nation-select"
              aria-label="지도에서 국가 선택"
              value={selectedNationId}
              onChange={(event) => onSelectNation(event.target.value)}
            >
              {campaign.nations.map((nation) => (
                <option key={nation.id} value={nation.id}>
                  {nation.nameKo}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="map_svg_frame" data-testid="world-map">
          <TypedComposableMap
            projectionConfig={{ scale: 170 }}
            role="img"
            aria-label={`세계 ${mode} 지도`}
          >
            <TypedGeographies geography={worldAtlas}>
              {({ geographies }) =>
                geographies.map((geography) => {
                  const name = geographyLabel(geography);
                  const factionId = factionForGeography(
                    name,
                    campaign.nations.map((nation) => nation.id),
                  );
                  return (
                    <TypedGeography
                      key={geography.rsmKey}
                      geography={geography}
                      fill={factionById.get(factionId ?? "")?.color ?? "var(--color-map-land)"}
                      stroke="var(--color-map-border)"
                      strokeWidth={0.35}
                      tabIndex={0}
                      data-testid={`faction-overlay-map-${factionId ?? "unknown"}`}
                      aria-label={`${name} 세력`}
                      onClick={() => {
                        if (factionId !== undefined) {
                          onSelectNation(factionId);
                        }
                      }}
                      onMouseEnter={() => setHoveredFactionId(factionId ?? null)}
                      onMouseLeave={() => setHoveredFactionId(null)}
                      onFocus={() => setHoveredFactionId(factionId ?? null)}
                      onBlur={() => setHoveredFactionId(null)}
                      style={{
                        default: { outline: "none", opacity: 0.88 },
                        hover: { outline: "none", opacity: 1, strokeWidth: 0.8 },
                        pressed: { outline: "none", opacity: 1, strokeWidth: 1 },
                      }}
                    />
                  );
                })
              }
            </TypedGeographies>
          </TypedComposableMap>
        </div>
        <div className="map_controls">
          {mapModes.map(([value, label]) => (
            <button
              className={`map_control ${mode === value ? "is_active" : ""}`}
              key={value}
              type="button"
              aria-label={`${label} 지도 모드`}
              aria-pressed={mode === value}
              data-testid={`map-mode-${value}`}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
          <button
            className={`map_control ${globeView ? "is_active" : ""}`}
            type="button"
            aria-label="지구본 보기"
            aria-pressed={globeView}
            data-testid="globe-view-toggle"
            onClick={() => setGlobeView((current) => !current)}
          >
            지구본
          </button>
        </div>
        <div className="map_legend">
          <span>
            <i className="legend_swatch land" aria-hidden="true" />
            토지
          </span>
          <span>
            <i className="legend_swatch ocean" aria-hidden="true" />
            해양
          </span>
          <span>
            <i className="legend_swatch planned" aria-hidden="true" />
            계획
          </span>
        </div>
        <div className="map_alternative" data-testid="map-alternative-list">
          <h2>
            지역 목록{" "}
            <span className="map_list_count">{ownedProvinces.length}곳 · 아래로 스크롤</span>
          </h2>
          <ul>
            {ownedProvinces.map((province) => (
              <li key={province.id}>
                <button className="province_button" type="button">
                  <span>{shortProvinceName(province.id)}</span>
                  <span className="province_owner">
                    {nationNameById.get(province.ownerNationId) ?? province.ownerNationId}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="map_faction_overlay" data-testid="faction-overlay-panel">
        <div className="map_faction_overlay_header">
          <div>
            <span className="eyebrow">세력 레이어</span>
            <h2>세력 오버레이</h2>
          </div>
          <span className="status_pill">클릭하여 검사</span>
        </div>
        <p className="map_faction_overlay_hint">
          지도 지역을 클릭하거나 세력 색상을 선택하면 국가 패널이 갱신됩니다.
        </p>
        <p className="map_faction_overlay_hover" data-testid="faction-overlay-hover" role="status">
          {hoveredFactionId === null
            ? "지역에 마우스를 올리면 세력 이름이 표시됩니다."
            : `${factionById.get(hoveredFactionId)?.nation.nameKo ?? hoveredFactionId} 세력`}
        </p>
        <ul className="map_faction_overlay_list">
          {factionEntries.map(({ nation, color }) => (
            <li key={nation.id}>
              <button
                className={`faction_overlay_button ${
                  selectedNationId === nation.id ? "is_active" : ""
                }`}
                data-testid={`faction-overlay-${nation.id}`}
                type="button"
                aria-pressed={selectedNationId === nation.id}
                onClick={() => onSelectNation(nation.id)}
                onMouseEnter={() => setHoveredFactionId(nation.id)}
                onMouseLeave={() => setHoveredFactionId(null)}
              >
                <span className="faction_overlay_swatch" style={{ backgroundColor: color }} />
                <span>{nation.nameKo}</span>
                <span className="faction_overlay_count">
                  {
                    campaign.provinces.filter((province) => province.ownerNationId === nation.id)
                      .length
                  }
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="map_entities" data-testid="map-entities">
        <h2>지도 표식</h2>
        <ul>
          {mapEntities.map((entity) => (
            <li key={entity}>{entity}</li>
          ))}
        </ul>
      </div>
      <form
        className="custom_geography_form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = customRegion.trim();
          if (trimmed.length === 0) {
            return;
          }
          setCustomRegions((current) => [...current, trimmed]);
          setCustomRegion("");
        }}
      >
        <label className="field">
          <span>사용자 지리</span>
          <input
            data-testid="custom-geography-input"
            value={customRegion}
            onChange={(event) => setCustomRegion(event.target.value)}
            placeholder="예: 신대륙 관문"
            maxLength={80}
          />
        </label>
        <button className="quiet_button" data-testid="add-custom-geography" type="submit">
          지형 추가
        </button>
      </form>
    </>
  );
};
