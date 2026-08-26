import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { DiplomacyPanel } from "../features/diplomacy/DiplomacyPanel";
import { NationPanel } from "../features/inspector/NationPanel";
import { GameLibrary } from "../features/library/GameLibrary";
import { WorldMap } from "../features/map/WorldMap";
import { MilitaryPanel } from "../features/military/MilitaryPanel";
import { OrderComposer } from "../features/orders/OrderComposer";
import { type PresetDraft, PresetEditor } from "../features/presets/PresetEditor";
import { CampaignSetupOptions } from "../features/setup/CampaignSetupOptions";
import { TimelinePanel } from "../features/timeline/TimelinePanel";
import {
  type Campaign,
  type CampaignCreationOptions,
  type CampaignDifficulty,
  type PlannerProvider,
  type StrategicPlan,
  type TimelineCadence,
  type TreatyClause,
  useCampaignStore,
} from "../state/campaign-store";

const integerFormatter = new Intl.NumberFormat("ko-KR");
const inspectorPanels = ["국가", "외교", "군사", "기록"] as const;
type InspectorPanel = (typeof inspectorPanels)[number];

const defaultScenarioOptions = [
  {
    id: "scn_ea1900",
    titleKo: "1900 동아시아",
    era: "industrial",
    genre: "historical",
    description: "대한제국과 주변 강대국의 산업화와 외교를 지휘합니다.",
    playerNationIds: ["nat_kor", "nat_jpn", "nat_qing", "nat_rus"],
    nations: [
      { id: "nat_kor", titleKo: "대한제국" },
      { id: "nat_jpn", titleKo: "일본제국" },
      { id: "nat_qing", titleKo: "청제국" },
      { id: "nat_rus", titleKo: "러시아제국" },
    ],
  },
];
const defaultNationOptions = [
  { id: "nat_kor", titleKo: "대한제국" },
  { id: "nat_jpn", titleKo: "일본제국" },
  { id: "nat_qing", titleKo: "청제국" },
  { id: "nat_rus", titleKo: "러시아제국" },
];
const CatalogSchema = z
  .object({
    scenarios: z.array(
      z
        .object({
          id: z.string(),
          titleKo: z.string(),
          era: z.string(),
          genre: z.string(),
          year: z.number().int(),
          playerNationIds: z.array(z.string()),
          nations: z.array(z.object({ id: z.string(), nameKo: z.string() }).strict()),
        })
        .strict(),
    ),
    countries: z.array(
      z
        .object({
          id: z.string(),
          alpha2: z.string(),
          alpha3: z.string(),
          numericCode: z.string(),
          nameKo: z.string(),
          nameEn: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
const defaultPreset: PresetDraft = {
  schema: "multiverse-history-preset/1",
  scenarioId: "scn_ea1900",
  titleKo: "1900 동아시아",
  era: "industrial",
  genre: "historical",
  year: 1900,
  licenseSpdx: "CC0-1.0",
  authors: ["Multiverse History Team"],
  sourceManifest: ["Public-domain historical facts; independently authored scenario"],
  assetManifest: ["Original generated geometry and deterministic neutral fallbacks"],
  nations: "대한제국, 일본제국, 청제국, 러시아제국",
  regions: "한반도, 일본 열도, 만주, 연해주",
  geography: "동아시아의 산맥과 해안선을 기반으로 한 1900년 지도",
  rules: "외교, 경제, 군사 행동은 턴 단위로 처리합니다.",
  history: "1900년 동아시아의 산업화와 제국 간 경쟁을 출발점으로 합니다.",
  brainstormPrompt: "새로운 역사적 분기와 세력의 선택지를 제안하세요.",
  polishPrompt: "시나리오 설명을 간결하고 일관된 문장으로 다듬으세요.",
};

const formatInteger = (value: number): string => integerFormatter.format(value);
const formatDate = (date: Campaign["date"]): string => `${date.year}년 ${date.quarter}분기`;
const formatRelation = (value: number): string => (value > 0 ? `+${value}` : String(value));
const formatClause = (clause: string): string => {
  switch (clause) {
    case "alliance":
      return "동맹";
    case "non_aggression":
      return "불가침";
    case "military_access":
      return "군사 통행";
    case "trade":
      return "통상";
    default:
      return clause;
  }
};
const downloadCampaign = async (
  onExport: () => Promise<string | null>,
  turn: number,
): Promise<void> => {
  const serialized = await onExport();
  if (serialized === null) {
    return;
  }
  const blobUrl = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `campaign-turn-${turn}.json`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};
const formatIntent = (type: StrategicPlan["npcIntents"][number]["type"]): string => {
  switch (type) {
    case "economy.invest":
      return "경제 투자";
    case "diplomacy.propose_treaty":
      return "통상 외교";
    case "military.recruit":
      return "병력 모집";
  }
};

const statusMetric = (
  label: string,
  value: string,
  testId: string,
  className = "",
): JSX.Element => (
  <div className="status_metric">
    <span className="status_metric_label">{label}</span>
    <span className={`status_metric_value ${className}`} data-testid={testId}>
      {value}
    </span>
  </div>
);

interface StartScreenProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onStart: (
    scenarioId: string,
    nationId: string,
    provider: PlannerProvider,
    options?: CampaignCreationOptions,
  ) => Promise<boolean>;
  readonly onImport: (json: string) => Promise<boolean>;
}

const StartScreen = ({ busy, error, onStart, onImport }: StartScreenProps): JSX.Element => {
  const [scenarioOptions, setScenarioOptions] = useState(defaultScenarioOptions);
  const [nationOptions, setNationOptions] = useState(defaultNationOptions);
  const [scenarioId, setScenarioId] = useState(defaultScenarioOptions[0]?.id ?? "");
  const [nationId, setNationId] = useState(defaultNationOptions[0]?.id ?? "");
  const [provider, setProvider] = useState<PlannerProvider>("deterministic");
  const [customPolityEnabled, setCustomPolityEnabled] = useState(false);
  const [customPolityName, setCustomPolityName] = useState("");
  const [difficulty, setDifficulty] = useState<CampaignDifficulty>("standard");
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  useEffect(() => {
    const loadCatalog = async (): Promise<void> => {
      try {
        const response = await fetch("/api/catalog");
        if (!response.ok) {
          return;
        }
        const catalog = CatalogSchema.parse(await response.json());
        const loadedScenarios = catalog.scenarios.map((scenario) => ({
          ...scenario,
          nations: scenario.nations.map((nation) => ({
            id: nation.id,
            titleKo: nation.nameKo,
          })),
          description:
            scenario.id === "scn_ea1900"
              ? "대한제국과 주변 강대국의 산업화와 외교를 지휘합니다."
              : `${scenario.year}년 · 모든 국가에서 시작할 수 있는 중립 시나리오`,
        }));
        const loadedNations = catalog.countries.map((country) => ({
          id: country.id,
          titleKo: country.nameKo,
        }));
        setScenarioOptions(loadedScenarios);
        setNationOptions(loadedNations);
        setScenarioId((current) =>
          loadedScenarios.some((scenario) => scenario.id === current)
            ? current
            : (loadedScenarios[0]?.id ?? current),
        );
        setNationId((current) =>
          loadedNations.some((nation) => nation.id === current)
            ? current
            : (loadedNations[0]?.id ?? current),
        );
      } catch {
        // Keep the compact built-in fallback when the catalog request is unavailable.
      } finally {
        setCatalogLoading(false);
      }
    };
    void loadCatalog();
  }, []);
  const scenario = scenarioOptions.find((option) => option.id === scenarioId);
  const availableNations =
    scenario?.nations ??
    nationOptions.filter((nation) => scenario?.playerNationIds.includes(nation.id) ?? true);
  const nation = availableNations.find((option) => option.id === nationId);
  useEffect(() => {
    if (availableNations.some((option) => option.id === nationId)) {
      return;
    }
    const firstNation = availableNations[0];
    if (firstNation !== undefined) {
      setNationId(firstNation.id);
    }
  }, [availableNations, nationId]);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await onStart(scenarioId, nationId, provider, {
      ...(customPolityEnabled && customPolityName.trim()
        ? { customPolityName: customPolityName.trim() }
        : {}),
      difficulty,
    });
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    await onImport(await file.text());
  };

  return (
    <main className="start_screen">
      <form className="start_card" onSubmit={submit}>
        <div>
          <span className="eyebrow">한국어 전략 시뮬레이션</span>
          <h1>Multiverse History</h1>
          <span className="load_indicator">
            {catalogLoading ? "목록 동기화 중" : `${scenarioOptions.length}개 시나리오`}
          </span>
        </div>
        <p>
          하나의 명령이 경제, 외교, 군사와 기록을 함께 움직입니다. 검증 가능한 상태를 바탕으로
          나만의 역사를 시작하세요.
        </p>
        <div className="picker_grid">
          <div className="field">
            <label htmlFor="scenario-select">시나리오</label>
            <select
              id="scenario-select"
              data-testid="scenario-select"
              value={scenarioId}
              onChange={(event) => setScenarioId(event.target.value)}
            >
              {scenarioOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.titleKo}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nation-select">플레이 국가</label>
            <select
              id="nation-select"
              data-testid="nation-select"
              value={nationId}
              onChange={(event) => setNationId(event.target.value)}
            >
              {availableNations.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.titleKo}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="scenario_detail" data-testid="scenario-summary">
          <strong>{scenario?.titleKo ?? "시나리오를 선택하세요"}</strong>
          <span>{scenario?.description ?? ""}</span>
        </div>
        <div className="scenario_detail" data-testid="nation-summary">
          <strong>{nation?.titleKo ?? "국가를 선택하세요"}</strong>
          <span>수도, 영토, 자원과 외교 관계를 직접 지휘합니다.</span>
        </div>
        <CampaignSetupOptions
          provider={provider}
          onProviderChange={setProvider}
          customPolityEnabled={customPolityEnabled}
          customPolityName={customPolityName}
          onCustomPolityEnabledChange={setCustomPolityEnabled}
          onCustomPolityNameChange={setCustomPolityName}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
        />
        {error !== null ? (
          <div className="error_banner" role="alert">
            {error}
          </div>
        ) : null}
        <button
          className="primary_button"
          data-testid="start-campaign"
          type="submit"
          disabled={busy}
        >
          {busy ? "세계 준비 중…" : "캠페인 시작"}
        </button>
        <GameLibrary />
        <button
          className="secondary_button"
          data-testid="open-preset-editor"
          type="button"
          onClick={() => setPresetEditorOpen((open) => !open)}
        >
          프리셋 편집기
        </button>
        <label className="file_button">
          저장 파일 가져오기
          <input
            data-testid="import-campaign-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importFile(event)}
          />
        </label>
        {presetEditorOpen ? (
          <PresetEditor initialPreset={defaultPreset} onClose={() => setPresetEditorOpen(false)} />
        ) : null}
      </form>
    </main>
  );
};

interface GameShellProps {
  readonly campaign: Campaign;
  readonly plan: StrategicPlan | null;
  readonly stateHash: string | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly saveStatus: string | null;
  readonly onNewCampaign: () => void;
  readonly onAdvance: (orderText: string) => Promise<boolean>;
  readonly onJumpTimeline: (cadence: TimelineCadence) => Promise<boolean>;
  readonly onSave: () => Promise<boolean>;
  readonly onExport: () => Promise<string | null>;
  readonly onProposeTreaty: (targetNationId: string, clause: TreatyClause) => Promise<boolean>;
  readonly onTransferTerritory: (targetNationId: string, provinceId: string) => Promise<boolean>;
  readonly onDeclareWar: (targetNationId: string) => Promise<boolean>;
  readonly onRecruit: (provinceId: string) => Promise<boolean>;
  readonly onMove: (unitId: string, provinceId: string) => Promise<boolean>;
  readonly onCombat: () => Promise<boolean>;
}

interface InspectorOverviewProps {
  readonly campaign: Campaign;
  readonly activePanel: InspectorPanel;
  readonly selectedNationId: string;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly onSelectNation: (nationId: string) => void;
  readonly onSelectDiplomacyNation: (nationId: string) => void;
  readonly busy: boolean;
  readonly onJumpTimeline: (cadence: TimelineCadence) => Promise<boolean>;
  readonly onSave: () => Promise<boolean>;
  readonly onProposeTreaty: (targetNationId: string, clause: TreatyClause) => Promise<boolean>;
  readonly onTransferTerritory: (targetNationId: string, provinceId: string) => Promise<boolean>;
  readonly onDeclareWar: (targetNationId: string) => Promise<boolean>;
  readonly onRecruit: (provinceId: string) => Promise<boolean>;
  readonly onMove: (unitId: string, provinceId: string) => Promise<boolean>;
  readonly onCombat: () => Promise<boolean>;
}

const ActiveInspectorPanel = ({
  campaign,
  activePanel,
  selectedNationId,
  nationNameById,
  onSelectNation,
  onSelectDiplomacyNation,
  busy,
  onJumpTimeline,
  onSave,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
  onRecruit,
  onMove,
  onCombat,
}: InspectorOverviewProps): JSX.Element => {
  switch (activePanel) {
    case "국가":
      return (
        <NationPanel
          campaign={campaign}
          selectedNationId={selectedNationId}
          nationNameById={nationNameById}
          onSelectNation={onSelectNation}
        />
      );
    case "외교":
      return (
        <DiplomacyPanel
          campaign={campaign}
          nationNameById={nationNameById}
          onSelectNation={onSelectDiplomacyNation}
          busy={busy}
          onProposeTreaty={onProposeTreaty}
          onTransferTerritory={onTransferTerritory}
          onDeclareWar={onDeclareWar}
        />
      );
    case "기록":
      return <TimelinePanel campaign={campaign} onJump={onJumpTimeline} onSave={onSave} />;
    case "군사":
      return (
        <MilitaryPanel
          campaign={campaign}
          nationNameById={nationNameById}
          busy={busy}
          onRecruit={onRecruit}
          onMove={onMove}
          onCombat={onCombat}
        />
      );
  }
};

const InspectorOverview = ({
  campaign,
  activePanel,
  selectedNationId,
  nationNameById,
  onSelectNation,
  onSelectDiplomacyNation,
  busy,
  onJumpTimeline,
  onSave,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
  onRecruit,
  onMove,
  onCombat,
}: InspectorOverviewProps): JSX.Element => {
  const inspectorNation =
    campaign.nations.find((nation) => nation.id === selectedNationId) ??
    campaign.nations.find((nation) => nation.id === campaign.playerNationId);

  return (
    <section className="panel_section">
      <h3>{activePanel} 개요</h3>
      <div className="metric_grid">
        <dl className="metric_card economy">
          <dt>국고</dt>
          <dd>{formatInteger(inspectorNation?.treasuryCredits ?? 0)}</dd>
        </dl>
        <dl className="metric_card">
          <dt>인구</dt>
          <dd data-testid="population-value">{formatInteger(inspectorNation?.population ?? 0)}</dd>
        </dl>
        <dl className="metric_card">
          <dt>기반시설</dt>
          <dd data-testid="infrastructure-value">
            {formatInteger(inspectorNation?.infrastructureBps ?? 0)}bp
          </dd>
        </dl>
        <dl className="metric_card">
          <dt>소유 지역</dt>
          <dd>
            {
              campaign.provinces.filter(
                (province) => province.ownerNationId === inspectorNation?.id,
              ).length
            }
          </dd>
        </dl>
      </div>
      <ActiveInspectorPanel
        campaign={campaign}
        activePanel={activePanel}
        selectedNationId={selectedNationId}
        nationNameById={nationNameById}
        onSelectNation={onSelectNation}
        onSelectDiplomacyNation={onSelectDiplomacyNation}
        busy={busy}
        onJumpTimeline={onJumpTimeline}
        onSave={onSave}
        onProposeTreaty={onProposeTreaty}
        onTransferTerritory={onTransferTerritory}
        onDeclareWar={onDeclareWar}
        onRecruit={onRecruit}
        onMove={onMove}
        onCombat={onCombat}
      />
      {activePanel !== "군사" ? (
        <p className="battle_report" data-testid="battle-report" role="status">
          {[...campaign.battleReports].reverse()[0] ?? "전투 결과가 아직 없습니다."}
        </p>
      ) : null}
    </section>
  );
};

const GameShell = ({
  campaign,
  plan,
  stateHash,
  busy,
  error,
  saveStatus,
  onNewCampaign,
  onAdvance,
  onJumpTimeline,
  onSave,
  onExport,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
  onRecruit,
  onMove,
  onCombat,
}: GameShellProps): JSX.Element => {
  const [activePanel, setActivePanel] = useState<InspectorPanel>("국가");
  const [selectedNationId, setSelectedNationId] = useState(campaign.playerNationId);
  const nationNameById = useMemo(
    () => new Map(campaign.nations.map((nation) => [nation.id, nation.nameKo])),
    [campaign.nations],
  );
  const player = campaign.nations.find((nation) => nation.id === campaign.playerNationId);
  const inspectorNation =
    campaign.nations.find((nation) => nation.id === selectedNationId) ?? player;
  const relations = campaign.relations.filter(
    (relation) => relation.fromNationId === campaign.playerNationId,
  );
  const selectNation = (nationId: string): void => {
    setSelectedNationId(nationId);
    setActivePanel("국가");
  };

  return (
    <div className="game_shell" data-testid="campaign-shell">
      <header className="game_topbar">
        <div className="brand_lockup">
          <span className="brand_mark" aria-hidden="true">
            M
          </span>
          <span className="brand_name">Multiverse History</span>
        </div>
        <div className="status_metrics">
          {statusMetric("턴", String(campaign.turn), "turn-value")}
          {statusMetric("시기", formatDate(campaign.date), "date-value")}
          {statusMetric(
            "국고",
            formatInteger(player?.treasuryCredits ?? 0),
            "treasury-value",
            "economy",
          )}
        </div>
        <div className="persistence_actions">
          <button
            className="quiet_button"
            data-testid="save-campaign"
            type="button"
            onClick={() => void onSave()}
          >
            저장
          </button>
          <button
            className="quiet_button"
            data-testid="export-campaign"
            type="button"
            onClick={() => void downloadCampaign(onExport, campaign.turn)}
          >
            내보내기
          </button>
          {saveStatus !== null ? (
            <span className="save_status" data-testid="save-status">
              {saveStatus}
            </span>
          ) : null}
          <button
            className="quiet_button"
            data-testid="new-campaign"
            type="button"
            onClick={onNewCampaign}
          >
            새 캠페인
          </button>
        </div>
      </header>
      {error !== null ? (
        <div className="error_banner" role="alert">
          {error}
        </div>
      ) : null}
      <div className="game_workspace" data-testid="campaign-state">
        <main className="game_map_region">
          <WorldMap
            campaign={campaign}
            nationNameById={nationNameById}
            selectedNationId={selectedNationId}
            onSelectNation={selectNation}
          />
        </main>
        <aside className="game_inspector" aria-label="국가 정보">
          <div className="inspector_heading">
            <div>
              <span className="eyebrow">현재 국가</span>
              <h2>{inspectorNation?.nameKo ?? campaign.playerNationId}</h2>
              <p>정치·경제·외교 상태를 한눈에 확인합니다.</p>
              <span className="scroll_hint">패널 내부 스크롤</span>
            </div>
            <span className="status_pill">싱글플레이</span>
          </div>
          <div className="inspector_tabs" role="tablist" aria-label="정보 패널">
            {inspectorPanels.map((tab) => (
              <button
                className="tab_button"
                key={tab}
                type="button"
                role="tab"
                aria-selected={activePanel === tab}
                onClick={() => setActivePanel(tab)}
                data-testid={`${tab === "국가" ? "nation" : tab === "외교" ? "diplomacy" : tab === "군사" ? "military" : "chronicle"}-tab`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="inspector_body">
            <InspectorOverview
              campaign={campaign}
              activePanel={activePanel}
              selectedNationId={selectedNationId}
              nationNameById={nationNameById}
              onSelectNation={selectNation}
              onSelectDiplomacyNation={setSelectedNationId}
              busy={busy}
              onJumpTimeline={onJumpTimeline}
              onSave={onSave}
              onProposeTreaty={onProposeTreaty}
              onTransferTerritory={onTransferTerritory}
              onDeclareWar={onDeclareWar}
              onRecruit={onRecruit}
              onMove={onMove}
              onCombat={onCombat}
            />
            <section className="panel_section">
              <h3>관계</h3>
              <ul className="relations_list" data-testid="relations-list">
                {relations.map((relation) => (
                  <li
                    className="relation_row"
                    key={`${relation.fromNationId}-${relation.toNationId}`}
                  >
                    <span>{nationNameById.get(relation.toNationId) ?? relation.toNationId}</span>
                    <strong>{formatRelation(relation.value)}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel_section">
              <h3>외교 결과</h3>
              <ul className="treaty_list" data-testid="treaty-list">
                {campaign.treaties.length === 0 ? (
                  <li className="panel_section p">아직 제안된 협정이 없습니다.</li>
                ) : (
                  campaign.treaties.map((treaty) => (
                    <li className="treaty_row" key={treaty.id}>
                      <span>
                        {nationNameById.get(treaty.recipientNationId) ?? treaty.recipientNationId}
                      </span>
                      <strong>{treaty.clauses.map(formatClause).join(", ")}</strong>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <section className="panel_section">
              <h3>AI 계획 감사</h3>
              <ul className="npc_list" data-testid="npc-actions">
                {plan?.npcIntents.length ? (
                  plan.npcIntents.map((intent) => (
                    <li
                      className="npc_row"
                      key={`${intent.type}-${intent.actorNationId}-${intent.type === "diplomacy.propose_treaty" ? intent.recipientNationId : intent.provinceId}`}
                    >
                      <span>{formatIntent(intent.type)}</span>
                      <span className="province_owner">비플레이어 계획</span>
                    </li>
                  ))
                ) : (
                  <li className="npc_row">
                    <span>아직 확정된 NPC 행동이 없습니다.</span>
                  </li>
                )}
              </ul>
            </section>
          </div>
        </aside>
      </div>
      <nav
        className="mobile_navigation"
        data-testid="mobile-navigation"
        aria-label="모바일 주요 메뉴"
      >
        <button
          type="button"
          onClick={() => document.getElementById("map-title")?.scrollIntoView({ block: "start" })}
        >
          지도
        </button>
        {inspectorPanels.slice(1).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-current={activePanel === tab ? "page" : undefined}
            onClick={() => setActivePanel(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <footer className="command_drawer">
        <OrderComposer busy={busy} error={error} onSubmit={onAdvance} />
        <section className="chronicle_scroll_area" aria-labelledby="chronicle-title">
          <h2 id="chronicle-title">연대기</h2>
          <span className="state_hash" data-testid="state-hash" title={stateHash ?? undefined}>
            상태 검증됨
          </span>
          <ul className="chronicle_list" data-testid="chronicle-list" aria-live="polite">
            {campaign.events.length === 0 ? (
              <li>첫 명령을 확정하면 이 세계의 기록이 시작됩니다.</li>
            ) : (
              campaign.events.map((event) => (
                <li key={event}>
                  <span className="chronicle_turn">확정 기록</span>
                  {event}
                </li>
              ))
            )}
          </ul>
        </section>
      </footer>
    </div>
  );
};

export const App = (): JSX.Element => {
  const campaign = useCampaignStore((state) => state.campaign);
  const startScreenRequested = useCampaignStore((state) => state.startScreenRequested);
  const plan = useCampaignStore((state) => state.plan);
  const stateHash = useCampaignStore((state) => state.stateHash);
  const busy = useCampaignStore((state) => state.busy);
  const error = useCampaignStore((state) => state.error);
  const saveStatus = useCampaignStore((state) => state.saveStatus);
  const loadCampaign = useCampaignStore((state) => state.loadCampaign);
  const beginNewCampaign = useCampaignStore((state) => state.beginNewCampaign);
  const createCampaign = useCampaignStore((state) => state.createCampaign);
  const advanceTurn = useCampaignStore((state) => state.advanceTurn);
  const jumpTimeline = useCampaignStore((state) => state.jumpTimeline);
  const saveCampaign = useCampaignStore((state) => state.saveCampaign);
  const exportCampaign = useCampaignStore((state) => state.exportCampaign);
  const importCampaign = useCampaignStore((state) => state.importCampaign);
  const proposeTreaty = useCampaignStore((state) => state.proposeTreaty);
  const declareWar = useCampaignStore((state) => state.declareWar);
  const recruitUnit = useCampaignStore((state) => state.recruitUnit);
  const moveUnit = useCampaignStore((state) => state.moveUnit);
  const resolveCombat = useCampaignStore((state) => state.resolveCombat);
  const transferTerritory = useCampaignStore((state) => state.transferTerritory);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  if (campaign === null || startScreenRequested) {
    return (
      <div className="game_shell" data-testid="campaign-shell">
        <StartScreen busy={busy} error={error} onStart={createCampaign} onImport={importCampaign} />
      </div>
    );
  }

  return (
    <GameShell
      campaign={campaign}
      plan={plan}
      stateHash={stateHash}
      busy={busy}
      error={error}
      saveStatus={saveStatus}
      onNewCampaign={beginNewCampaign}
      onAdvance={advanceTurn}
      onJumpTimeline={jumpTimeline}
      onSave={saveCampaign}
      onExport={exportCampaign}
      onProposeTreaty={proposeTreaty}
      onTransferTerritory={transferTerritory}
      onDeclareWar={declareWar}
      onRecruit={recruitUnit}
      onMove={moveUnit}
      onCombat={resolveCombat}
    />
  );
};
