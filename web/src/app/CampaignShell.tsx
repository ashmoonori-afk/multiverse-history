import { useMemo, useState } from "react";

import { SearchableSelect } from "../features/controls/SearchableSelect";
import { CampaignChatDrawer } from "../features/diplomacy/CampaignChatDrawer";
import { OpenHistoriaHud } from "../features/hud/OpenHistoriaHud";
import { WorldMap } from "../features/map/WorldMap";
import { OrderComposer } from "../features/orders/OrderComposer";
import { ResolutionSummary } from "../features/resolution/ResolutionSummary";
import { TurnResultPanel } from "../features/resolution/TurnResultPanel";
import type {
  Campaign,
  StrategicPlan,
  TimelineCadence,
  TimelineProgressionRequest,
  TreatyClause,
} from "../state/campaign-store";
import { CampaignAdvisor, type InspectorPanel } from "./CampaignAdvisor";
import { formatCampaignYear } from "./campaign-date";

interface CampaignShellProps {
  readonly campaign: Campaign;
  readonly plan: StrategicPlan | null;
  readonly stateHash: string | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly saveStatus: string | null;
  readonly onNewCampaign: () => void;
  readonly onAdvance: (orderText: string, cadence?: TimelineCadence) => Promise<boolean>;
  readonly onSendChat: (
    targetNationIdOrIds: string | readonly string[],
    message: string,
  ) => Promise<boolean>;
  readonly onJumpTimeline: (cadence: TimelineCadence) => Promise<boolean>;
  readonly onProgressTimeline: (progression: TimelineProgressionRequest) => Promise<boolean>;
  readonly onSave: () => Promise<boolean>;
  readonly onExport: () => Promise<string | null>;
  readonly onProposeTreaty: (targetNationId: string, clause: TreatyClause) => Promise<boolean>;
  readonly onTransferTerritory: (targetNationId: string, provinceId: string) => Promise<boolean>;
  readonly onDeclareWar: (targetNationId: string) => Promise<boolean>;
  readonly onRecruit: (provinceId: string) => Promise<boolean>;
  readonly onMove: (unitId: string, provinceId: string) => Promise<boolean>;
  readonly onCombat: () => Promise<boolean>;
}

const downloadCampaign = async (
  onExport: () => Promise<string | null>,
  turn: number,
): Promise<void> => {
  const serialized = await onExport();
  if (serialized === null) return;
  const blobUrl = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `campaign-turn-${turn}.json`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};

export const CampaignShell = ({
  campaign,
  stateHash,
  busy,
  error,
  saveStatus,
  onNewCampaign,
  onAdvance,
  onSendChat,
  onJumpTimeline,
  onProgressTimeline,
  onSave,
  onExport,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
  onRecruit,
  onMove,
  onCombat,
}: CampaignShellProps): JSX.Element => {
  const [activePanel, setActivePanel] = useState<InspectorPanel>("국가");
  const [actionPanelState, setActionPanelState] = useState<"compose" | "resolving" | "committed">(
    "compose",
  );
  const [selectedNationId, setSelectedNationId] = useState(campaign.playerNationId);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(
    campaign.provinces.find((province) => province.ownerNationId === campaign.playerNationId)?.id ??
      campaign.provinces[0]?.id ??
      null,
  );
  const nationNameById = useMemo(
    () => new Map(campaign.nations.map((nation) => [nation.id, nation.nameKo])),
    [campaign.nations],
  );
  const nationSearchOptions = useMemo(
    () => campaign.nations.map((nation) => ({ id: nation.id, label: nation.nameKo })),
    [campaign.nations],
  );
  const latestResolution = campaign.resolutions[campaign.resolutions.length - 1];
  const incomingChatCount = campaign.chatMessages.filter(
    (message) => message.role === "counterpart" && message.turn === campaign.turn,
  ).length;
  const player = campaign.nations.find((nation) => nation.id === campaign.playerNationId);
  const selectNation = (nationId: string): void => setSelectedNationId(nationId);
  const selectProvince = (provinceId: string | null): void => {
    setSelectedProvinceId(provinceId);
    const ownerNationId = campaign.provinces.find(
      (province) => province.id === provinceId,
    )?.ownerNationId;
    if (ownerNationId !== undefined) setSelectedNationId(ownerNationId);
  };
  const playerName = player?.nameKo ?? campaign.playerNationId;
  const dateLabel = `${formatCampaignYear(campaign.date.year)} ${campaign.date.quarter}분기`;
  const sessionLabel = `${campaign.scenarioTitleKo} / ${playerName} / ${dateLabel}`;
  const flagLabel =
    {
      nat_kor: "☯",
      nat_jpn: "日",
      nat_qing: "清",
      nat_rus: "Р",
    }[campaign.playerNationId] ?? playerName.slice(0, 1);
  const commitOrder = async (orderText: string, cadence: TimelineCadence): Promise<boolean> => {
    setActionPanelState("resolving");
    const committed = await onAdvance(orderText, cadence);
    setActionPanelState(committed ? "committed" : "compose");
    return committed;
  };

  return (
    <div className="oh_campaign_shell" data-testid="campaign-shell">
      <div className="oh_campaign_state" data-testid="campaign-state" />
      {error !== null ? (
        <div className="oh_error" role="alert">
          {error}
        </div>
      ) : null}
      <WorldMap
        campaign={campaign}
        nationNameById={nationNameById}
        selectedNationId={selectedNationId}
        selectedProvinceId={selectedProvinceId}
        onSelectNation={selectNation}
        onSelectProvince={selectProvince}
      />
      <OpenHistoriaHud
        sessionLabel={sessionLabel}
        playerName={playerName}
        dateLabel={dateLabel}
        flagLabel={flagLabel}
        campaignTurn={campaign.turn}
        incomingChatCount={incomingChatCount}
        onExit={onNewCampaign}
        settingsContent={
          <div className="oh_settings_content">
            <strong>Open Historia</strong>
            <span>{saveStatus ?? "로컬 캠페인"}</span>
            <span className="oh_state_hash" title={stateHash ?? undefined}>
              상태 검증됨
            </span>
            <button type="button" disabled={busy} onClick={() => void onSave()}>
              저장
            </button>
            <button type="button" onClick={() => void downloadCampaign(onExport, campaign.turn)}>
              내보내기
            </button>
            <button type="button" onClick={onNewCampaign}>
              새 캠페인
            </button>
          </div>
        }
        chatContent={(closeChat) => (
          <CampaignChatDrawer
            campaign={campaign}
            nationNameById={nationNameById}
            busy={busy}
            onClose={closeChat}
            onSendChat={onSendChat}
            onSendGroupChat={onSendChat}
          />
        )}
        actionsContent={
          actionPanelState === "resolving" ? (
            <TurnResultPanel state="resolving" />
          ) : actionPanelState === "committed" && latestResolution !== undefined ? (
            <TurnResultPanel
              state="committed"
              resolution={latestResolution}
              playerNationId={campaign.playerNationId}
              nationNameById={nationNameById}
              onContinue={() => setActionPanelState("compose")}
            />
          ) : (
            <div className="oh_actions_content">
              <ResolutionSummary campaign={campaign} />
              <OrderComposer busy={busy} error={error} onSubmit={commitOrder} />
            </div>
          )
        }
        advisorContent={
          <CampaignAdvisor
            campaign={campaign}
            activePanel={activePanel}
            selectedNationId={selectedNationId}
            selectedProvinceId={selectedProvinceId}
            nationNameById={nationNameById}
            onSelectNation={selectNation}
            onSelectPanel={setActivePanel}
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
        }
        searchContent={
          <div className="nation_search_panel">
            <strong>국가 검색</strong>
            <SearchableSelect
              label="국가 검색"
              testId="hud-nation-search"
              optionTestIdPrefix="hud-nation-option"
              placeholder="국가 이름 또는 코드 검색"
              options={nationSearchOptions}
              value={selectedNationId}
              onSelect={selectNation}
            />
          </div>
        }
      />
    </div>
  );
};
