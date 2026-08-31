import { type ReactNode, useEffect, useState } from "react";
import "./chat-notification.css";

interface OpenHistoriaHudProps {
  readonly sessionLabel: string;
  readonly playerName: string;
  readonly dateLabel: string;
  readonly flagLabel: string;
  readonly campaignTurn: number;
  readonly incomingChatCount: number;
  readonly settingsContent: ReactNode;
  readonly chatContent: (onClose: () => void) => ReactNode;
  readonly actionsContent: ReactNode;
  readonly advisorContent: ReactNode;
  readonly searchContent: ReactNode;
  readonly onExit: () => void;
}

type PanelName = "settings" | "chat" | "actions" | "advisor" | "search";

export const OpenHistoriaHud = ({
  sessionLabel,
  playerName,
  dateLabel,
  flagLabel,
  campaignTurn,
  incomingChatCount,
  settingsContent,
  chatContent,
  actionsContent,
  advisorContent,
  searchContent,
  onExit,
}: OpenHistoriaHudProps): JSX.Element => {
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 700);
  const [readChatMarker, setReadChatMarker] = useState({ turn: -1, count: 0 });
  const readChatCount = readChatMarker.turn === campaignTurn ? readChatMarker.count : 0;
  const unreadChatCount = Math.max(0, incomingChatCount - readChatCount);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const updateCompact = (event: MediaQueryListEvent): void => setCompact(event.matches);
    setCompact(media.matches);
    media.addEventListener("change", updateCompact);
    return () => media.removeEventListener("change", updateCompact);
  }, []);

  useEffect(() => {
    if (openPanel === "chat") {
      setReadChatMarker({ turn: campaignTurn, count: incomingChatCount });
    }
  }, [campaignTurn, incomingChatCount, openPanel]);

  const togglePanel = (panel: PanelName): void => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };
  const closePanel = (panel: PanelName): void => {
    setOpenPanel((current) => (current === panel ? null : current));
  };

  return (
    <div
      className="oh_hud"
      data-testid="open-historia-hud"
      data-open-panel={openPanel ?? "none"}
      data-compact={compact}
    >
      <button
        className="oh_island oh_settings"
        data-testid="oh-settings"
        type="button"
        aria-label="설정 열기"
        aria-expanded={openPanel === "settings"}
        onClick={() => togglePanel("settings")}
      >
        ⋮
      </button>
      {compact ? null : (
        <>
          <div className="oh_island oh_session" data-testid="oh-session">
            {sessionLabel}
          </div>
          <button
            className="oh_island oh_exit"
            data-testid="oh-exit"
            type="button"
            onClick={onExit}
          >
            <span data-testid="new-campaign">⌂ 새 캠페인</span>
          </button>
        </>
      )}
      <div className="oh_island oh_date" data-testid="oh-date">
        <strong>{playerName}</strong>
        <span>{dateLabel}</span>
      </div>
      <button
        className="oh_island oh_chat"
        data-testid="oh-chat"
        type="button"
        aria-label={unreadChatCount > 0 ? `외교 채팅, 새 메시지 ${unreadChatCount}개` : "외교 채팅"}
        aria-expanded={openPanel === "chat"}
        onClick={() => togglePanel("chat")}
      >
        💬
        {unreadChatCount > 0 ? (
          <span className="oh_chat_badge" data-testid="incoming-chat-count">
            {unreadChatCount}
          </span>
        ) : null}
      </button>
      <button
        className="oh_island oh_actions"
        data-testid="oh-actions"
        type="button"
        aria-label="행동과 명령"
        aria-expanded={openPanel === "actions"}
        onClick={() => togglePanel("actions")}
      >
        ✦
      </button>
      <button
        className="oh_island oh_search"
        data-testid="oh-search"
        type="button"
        aria-label="국가 검색"
        aria-expanded={openPanel === "search"}
        onClick={() => togglePanel("search")}
      >
        ⌕
      </button>
      <button
        className="oh_island oh_player_flag"
        data-testid="oh-player-flag"
        type="button"
        aria-label={`${playerName} 정보`}
        aria-expanded={openPanel === "advisor"}
        onClick={() => togglePanel("advisor")}
      >
        {flagLabel}
      </button>
      <button
        className="oh_island oh_advisor"
        data-testid="oh-advisor"
        type="button"
        aria-label={openPanel === "advisor" ? "전략 자문 닫기" : "전략 자문"}
        aria-expanded={openPanel === "advisor"}
        onClick={() => togglePanel("advisor")}
      >
        🧭
      </button>

      {openPanel === "settings" ? (
        <section className="oh_panel oh_settings_panel" aria-label="설정">
          <div className="oh_panel_body">{settingsContent}</div>
        </section>
      ) : null}
      {openPanel === "chat" ? (
        <section className="oh_panel oh_chat_panel" aria-label="외교 채팅">
          <div className="oh_panel_body">{chatContent(() => closePanel("chat"))}</div>
        </section>
      ) : null}
      {openPanel === "actions" ? (
        <section className="oh_panel oh_actions_panel" aria-label="행동과 명령">
          <div className="oh_panel_body">{actionsContent}</div>
        </section>
      ) : null}
      {openPanel === "advisor" ? (
        <aside className="oh_panel oh_advisor_panel" aria-label="전략 자문">
          <button
            className="oh_panel_close"
            data-testid="close-advisor"
            type="button"
            aria-label="전략 자문 닫기"
            onClick={() => closePanel("advisor")}
          >
            닫기
          </button>
          <div className="oh_panel_body" data-testid="advisor-scroll-body">
            {advisorContent}
          </div>
        </aside>
      ) : null}
      {openPanel === "search" ? (
        <section className="oh_panel oh_search_panel" aria-label="국가 검색">
          <div className="oh_panel_body">{searchContent}</div>
        </section>
      ) : null}
    </div>
  );
};
