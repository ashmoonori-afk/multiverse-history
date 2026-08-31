import { DiplomacyPanel } from "../features/diplomacy/DiplomacyPanel";
import { NationPanel } from "../features/inspector/NationPanel";
import { ProvinceInspector } from "../features/map/ProvinceInspector";
import { MilitaryPanel } from "../features/military/MilitaryPanel";
import { ResolutionFeed } from "../features/resolution/ResolutionFeed";
import { TimelinePanel } from "../features/timeline/TimelinePanel";
import type {
  Campaign,
  TimelineCadence,
  TimelineProgressionRequest,
  TreatyClause,
} from "../state/campaign-store";

const integerFormatter = new Intl.NumberFormat("ko-KR");
export const inspectorPanels = ["국가", "외교", "군사", "기록"] as const;
export type InspectorPanel = (typeof inspectorPanels)[number];

interface CampaignAdvisorProps {
  readonly campaign: Campaign;
  readonly activePanel: InspectorPanel;
  readonly selectedNationId: string;
  readonly selectedProvinceId: string | null;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly onSelectNation: (nationId: string) => void;
  readonly onSelectPanel: (panel: InspectorPanel) => void;
  readonly busy: boolean;
  readonly onJumpTimeline: (cadence: TimelineCadence) => Promise<boolean>;
  readonly onProgressTimeline: (progression: TimelineProgressionRequest) => Promise<boolean>;
  readonly onSave: () => Promise<boolean>;
  readonly onProposeTreaty: (targetNationId: string, clause: TreatyClause) => Promise<boolean>;
  readonly onTransferTerritory: (targetNationId: string, provinceId: string) => Promise<boolean>;
  readonly onDeclareWar: (targetNationId: string) => Promise<boolean>;
  readonly onRecruit: (provinceId: string) => Promise<boolean>;
  readonly onMove: (unitId: string, provinceId: string) => Promise<boolean>;
  readonly onCombat: () => Promise<boolean>;
}

type ActivePanelProps = Omit<CampaignAdvisorProps, "selectedProvinceId" | "onSelectPanel">;

const ActivePanel = ({
  campaign,
  activePanel,
  selectedNationId,
  nationNameById,
  onSelectNation,
  busy,
  onJumpTimeline,
  onProgressTimeline,
  onSave,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
  onRecruit,
  onMove,
  onCombat,
}: ActivePanelProps): JSX.Element => {
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
          onSelectNation={onSelectNation}
          busy={busy}
          onProposeTreaty={onProposeTreaty}
          onTransferTerritory={onTransferTerritory}
          onDeclareWar={onDeclareWar}
        />
      );
    case "기록":
      return (
        <TimelinePanel
          campaign={campaign}
          onJump={onJumpTimeline}
          onSave={onSave}
          onProgression={onProgressTimeline}
        />
      );
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

export const CampaignAdvisor = ({
  campaign,
  activePanel,
  selectedNationId,
  selectedProvinceId,
  nationNameById,
  onSelectNation,
  onSelectPanel,
  busy,
  onJumpTimeline,
  onProgressTimeline,
  onSave,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
  onRecruit,
  onMove,
  onCombat,
}: CampaignAdvisorProps): JSX.Element => {
  const selectedNation = campaign.nations.find((nation) => nation.id === selectedNationId);
  const inspectorNation =
    selectedNation ?? campaign.nations.find((nation) => nation.id === campaign.playerNationId);
  const showCampaignOverview = activePanel !== "기록";

  return (
    <div className="oh_advisor_content">
      <header>
        <span>전략 자문</span>
        <h2>{selectedNation?.nameKo ?? selectedNationId}</h2>
      </header>
      <nav aria-label="자문 패널">
        {inspectorPanels.map((panel) => (
          <button
            key={panel}
            type="button"
            aria-current={activePanel === panel ? "page" : undefined}
            onClick={() => onSelectPanel(panel)}
          >
            {panel}
          </button>
        ))}
      </nav>
      <section className="panel_section">
        <h3>{activePanel} 개요</h3>
        {showCampaignOverview ? (
          <>
            <ProvinceInspector
              campaign={campaign}
              nationNameById={nationNameById}
              selectedProvinceId={selectedProvinceId}
            />
            <ResolutionFeed campaign={campaign} nationNameById={nationNameById} />
            <div className="metric_grid">
              <dl className="metric_card economy">
                <dt>국고</dt>
                <dd>{integerFormatter.format(inspectorNation?.treasuryCredits ?? 0)}</dd>
              </dl>
              <dl className="metric_card">
                <dt>인구</dt>
                <dd data-testid="population-value">
                  {integerFormatter.format(inspectorNation?.population ?? 0)}
                </dd>
              </dl>
              <dl className="metric_card">
                <dt>기반시설</dt>
                <dd data-testid="infrastructure-value">
                  {integerFormatter.format(inspectorNation?.infrastructureBps ?? 0)}bp
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
          </>
        ) : null}
        <ActivePanel
          campaign={campaign}
          activePanel={activePanel}
          selectedNationId={selectedNationId}
          nationNameById={nationNameById}
          onSelectNation={onSelectNation}
          busy={busy}
          onJumpTimeline={onJumpTimeline}
          onProgressTimeline={onProgressTimeline}
          onSave={onSave}
          onProposeTreaty={onProposeTreaty}
          onTransferTerritory={onTransferTerritory}
          onDeclareWar={onDeclareWar}
          onRecruit={onRecruit}
          onMove={onMove}
          onCombat={onCombat}
        />
        {activePanel !== "군사" && activePanel !== "기록" ? (
          <p className="battle_report" data-testid="battle-report" role="status">
            {[...campaign.battleReports].reverse()[0] ?? "전투 결과가 아직 없습니다."}
          </p>
        ) : null}
      </section>
    </div>
  );
};
