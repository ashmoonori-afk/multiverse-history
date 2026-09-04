import { useEffect, useRef, useState } from "react";

import type { Campaign, CampaignSlotSummary } from "../../state/campaign-store";
import "./save-menu.css";

const SLOT_ID = /^[a-z0-9_-]{1,32}$/;

interface SaveMenuProps {
  readonly campaign: Campaign;
  readonly stateHash: string | null;
  readonly slots: readonly CampaignSlotSummary[];
  readonly busy: boolean;
  readonly error: string | null;
  readonly status: string | null;
  readonly onRefresh: () => Promise<boolean>;
  readonly onSave: (slot: string) => Promise<boolean>;
  readonly onLoad: (slot: string) => Promise<boolean>;
  readonly onExport: () => Promise<void>;
  readonly onNewCampaign: () => void;
}

export const SaveMenu = ({
  campaign,
  stateHash,
  slots,
  busy,
  error,
  status,
  onRefresh,
  onSave,
  onLoad,
  onExport,
  onNewCampaign,
}: SaveMenuProps): JSX.Element => {
  const [slotId, setSlotId] = useState("save-1");
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const loadTrigger = useRef<HTMLButtonElement | null>(null);
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const validSlot = SLOT_ID.test(slotId);

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    if (pendingSlot === null) {
      loadTrigger.current?.focus();
      return;
    }

    const dialog = confirmationRef.current;
    if (dialog === null) return;
    const focusable = (): readonly HTMLButtonElement[] => [
      ...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    focusable()[0]?.focus();

    const keepFocusInside = (event: FocusEvent): void => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusable()[0]?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingSlot(null);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = focusable();
      if (buttons.length === 0) return;
      const activeIndex = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
      const nextIndex = (activeIndex + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[nextIndex]?.focus();
    };

    document.addEventListener("focusin", keepFocusInside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingSlot]);

  const closeConfirmation = (): void => setPendingSlot(null);
  const confirmLoad = async (): Promise<void> => {
    if (pendingSlot === null) return;
    await onLoad(pendingSlot);
    closeConfirmation();
  };

  return (
    <section className="save_menu" aria-labelledby="save-menu-title">
      <header className="save_menu_header">
        <div>
          <span className="eyebrow">로컬 캠페인</span>
          <h2 id="save-menu-title">저장 슬롯</h2>
        </div>
        <span className="oh_state_hash" title={stateHash ?? undefined}>
          {stateHash === null ? "상태 해시 없음" : `상태 ${stateHash.slice(0, 8)}`}
        </span>
      </header>

      <form
        className="save_menu_form"
        onSubmit={(event) => {
          event.preventDefault();
          if (validSlot && !busy) void onSave(slotId);
        }}
      >
        <label className="field" htmlFor="save-slot-id">
          <span>슬롯 ID</span>
          <input
            id="save-slot-id"
            data-testid="save-slot-id"
            value={slotId}
            onChange={(event) => setSlotId(event.target.value)}
            aria-invalid={!validSlot}
            aria-describedby="save-slot-help"
            maxLength={32}
            autoComplete="off"
          />
        </label>
        <p id="save-slot-help" className="save_menu_help">
          소문자 영문, 숫자, _, -만 1~32자로 입력하세요.
        </p>
        {!validSlot ? (
          <p className="save_menu_validation" role="alert">
            슬롯 ID는 소문자 영문, 숫자, _, -만 사용할 수 있습니다.
          </p>
        ) : null}
        <button
          className="primary_button"
          data-testid="save-slot-submit"
          type="submit"
          disabled={busy || !validSlot}
        >
          슬롯 저장
        </button>
      </form>

      <div className="save_menu_slot_body" data-testid="save-slot-list">
        {busy && slots.length === 0 ? <p>저장 슬롯을 불러오는 중…</p> : null}
        {!busy && slots.length === 0 ? <p>저장된 슬롯이 없습니다.</p> : null}
        {slots.length > 0 ? (
          <ul className="save_slot_list">
            {slots.map((slot) => (
              <li key={slot.slot} data-testid={`save-slot-${slot.slot}`}>
                <div>
                  <strong>{slot.slot}</strong>
                  <span>
                    {slot.scenarioId} / {slot.playerNationId}
                  </span>
                  <span>
                    턴 {slot.savedAtTurn} · {slot.stateHash.slice(0, 8)}
                  </span>
                </div>
                <button
                  className="quiet_button"
                  data-testid={`load-slot-${slot.slot}`}
                  type="button"
                  disabled={busy}
                  aria-label={`${slot.slot} 슬롯 불러오기`}
                  onClick={(event) => {
                    loadTrigger.current = event.currentTarget;
                    setPendingSlot(slot.slot);
                  }}
                >
                  불러오기
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {pendingSlot === null ? null : (
        <div
          className="save_menu_confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="load-slot-title"
          aria-describedby="load-slot-description"
          ref={confirmationRef}
          tabIndex={-1}
        >
          <strong id="load-slot-title">{pendingSlot} 슬롯을 불러올까요?</strong>
          <p id="load-slot-description">현재 메모리의 캠페인 상태가 교체됩니다.</p>
          <div className="cluster">
            <button className="primary_button" type="button" onClick={() => void confirmLoad()}>
              불러오기 확인
            </button>
            <button className="quiet_button" type="button" onClick={closeConfirmation}>
              취소
            </button>
          </div>
        </div>
      )}

      <footer className="save_menu_footer">
        <p className="save_menu_status" data-testid="save-menu-status" aria-live="polite">
          {error ?? status ?? (busy ? "처리 중…" : `현재 턴 ${campaign.turn}`)}
        </p>
        <div className="cluster">
          <button
            className="quiet_button"
            type="button"
            disabled={busy}
            onClick={() => void onRefresh()}
          >
            새로고침
          </button>
          <button className="quiet_button" type="button" onClick={() => void onExport()}>
            내보내기
          </button>
          <button className="quiet_button" type="button" onClick={onNewCampaign}>
            새 캠페인
          </button>
        </div>
      </footer>
    </section>
  );
};
