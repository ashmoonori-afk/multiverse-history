import { useEffect } from "react";

import { useCampaignStore } from "../state/campaign-store";
import { CampaignShell } from "./CampaignShell";
import { StartScreen } from "./StartScreen";

export const App = (): JSX.Element => {
  const campaign = useCampaignStore((state) => state.campaign);
  const bootstrapReady = useCampaignStore((state) => state.bootstrapReady);
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
  const sendChat = useCampaignStore((state) => state.sendChat);
  const jumpTimeline = useCampaignStore((state) => state.jumpTimeline);
  const progressTimeline = useCampaignStore((state) => state.progressTimeline);
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

  if (!bootstrapReady) {
    return (
      <div className="game_shell" data-testid="campaign-shell" data-bootstrap-ready="false">
        <main className="start_screen">
          <p className="load_indicator">세계 기록 불러오는 중…</p>
        </main>
      </div>
    );
  }

  if (campaign === null || startScreenRequested) {
    return (
      <div className="game_shell" data-testid="campaign-shell" data-bootstrap-ready="true">
        <StartScreen busy={busy} error={error} onStart={createCampaign} onImport={importCampaign} />
      </div>
    );
  }

  return (
    <CampaignShell
      campaign={campaign}
      plan={plan}
      stateHash={stateHash}
      busy={busy}
      error={error}
      saveStatus={saveStatus}
      onNewCampaign={beginNewCampaign}
      onAdvance={advanceTurn}
      onSendChat={sendChat}
      onJumpTimeline={jumpTimeline}
      onProgressTimeline={progressTimeline}
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
