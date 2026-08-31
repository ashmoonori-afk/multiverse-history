import { type FormEvent, useState } from "react";

import type { Campaign } from "../../state/campaign-store";
import type { CampaignChatRoom } from "./campaign-chat-rooms";

interface CampaignChatRoomThreadProps {
  readonly campaign: Campaign;
  readonly room: CampaignChatRoom | undefined;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly participantNationIds: readonly string[];
  readonly busy: boolean;
  readonly startingNew: boolean;
  readonly onBack: () => void;
  readonly onSelectPrimaryParticipant: (nationId: string) => void;
  readonly onToggleParticipant: (nationId: string) => void;
  readonly onSendChat: (targetNationIds: readonly string[], message: string) => Promise<boolean>;
}

export const CampaignChatRoomThread = ({
  campaign,
  room,
  nationNameById,
  participantNationIds,
  busy,
  startingNew,
  onBack,
  onSelectPrimaryParticipant,
  onToggleParticipant,
  onSendChat,
}: CampaignChatRoomThreadProps): JSX.Element => {
  const [message, setMessage] = useState("");
  const targetNations = campaign.nations.filter((nation) => nation.id !== campaign.playerNationId);
  const nationName = (nationId: string): string => nationNameById.get(nationId) ?? nationId;
  const selectedNationIds = startingNew ? participantNationIds : (room?.counterpartNationIds ?? []);
  const addableNations = targetNations.filter((nation) => !selectedNationIds.includes(nation.id));
  const primaryName = nationName(selectedNationIds[0] ?? "");
  const audienceLabel =
    selectedNationIds.length > 1
      ? `${primaryName} 외 ${selectedNationIds.length - 1}개국`
      : primaryName;
  const composerLabel =
    selectedNationIds.length === 0 ? "대화 상대를 선택하세요" : `${audienceLabel}에 보낼 메시지`;

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || selectedNationIds.length === 0) {
      return;
    }
    if (await onSendChat(selectedNationIds, trimmedMessage)) {
      setMessage("");
    }
  };

  return (
    <section className="chat_thread" aria-label={`${audienceLabel} 외교 대화`}>
      <div className="chat_thread_top">
        <div className="chat_thread_heading">
          <button
            className="chat_thread_back"
            data-testid="chat-thread-back"
            type="button"
            onClick={onBack}
          >
            ← 채팅룸
          </button>
          <div>
            <strong>{startingNew ? "새 외교 채팅" : room?.subjectKo}</strong>
            <span>{selectedNationIds.map(nationName).join(" · ")}</span>
          </div>
        </div>
        <ul
          className="chat_participants"
          data-testid="chat-participants"
          aria-label={startingNew ? "대화 참여국 선택" : "대화 참여국"}
        >
          {selectedNationIds.map((nationId, order) => {
            const label = nationName(nationId);
            const chipBody = (
              <>
                <span className="chat_participant_order" aria-hidden="true">
                  {order + 1}
                </span>
                {label}
                {startingNew ? (
                  <span className="chat_participant_dismiss" aria-hidden="true">
                    ×
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={nationId}>
                {startingNew ? (
                  <button
                    className="chat_participant"
                    data-testid={`chat-participant-${nationId}`}
                    data-nation-id={nationId}
                    data-selected="true"
                    data-order={order}
                    type="button"
                    aria-label={`${label} 참여국에서 제외`}
                    onClick={() => onToggleParticipant(nationId)}
                  >
                    {chipBody}
                  </button>
                ) : (
                  <span
                    className="chat_participant"
                    data-testid={`chat-participant-${nationId}`}
                    data-nation-id={nationId}
                    data-selected="true"
                    data-order={order}
                  >
                    {chipBody}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {startingNew ? (
          <div className="chat_thread_target">
            <label className="field">
              <span>대표 대화 상대</span>
              <select
                data-testid="chat-target"
                value={selectedNationIds[0] ?? ""}
                onChange={(event) => onSelectPrimaryParticipant(event.target.value)}
              >
                {targetNations.map((nation) => (
                  <option key={nation.id} value={nation.id}>
                    {nation.nameKo}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>참여국 추가</span>
              <select
                data-testid="chat-add-participant"
                value=""
                onChange={(event) => {
                  if (event.target.value.length > 0) {
                    onToggleParticipant(event.target.value);
                  }
                }}
              >
                <option value="">추가할 국가 선택</option>
                {addableNations.map((nation) => (
                  <option key={nation.id} value={nation.id}>
                    {nation.nameKo}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <ul className="chat_thread_messages" data-testid="chat-room-thread" aria-live="polite">
        {room?.messages.map((entry) => (
          <li
            className={`chat_message chat_message_${entry.role}`}
            data-testid={entry.role === "counterpart" ? "chat-reply" : "chat-player-message"}
            data-topic={entry.topic}
            data-intent={entry.intent}
            data-nation-id={entry.speakerNationId}
            data-sequence={entry.sequence}
            key={entry.id}
          >
            <span className="chat_message_meta">
              {entry.role === "player" ? "플레이어" : nationName(entry.speakerNationId)} · 턴{" "}
              {entry.turn}
            </span>
            <span>{entry.text}</span>
          </li>
        )) ?? <li className="chat_empty">첫 메시지로 외교 채팅을 시작하세요.</li>}
      </ul>
      <form className="chat_composer" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>{composerLabel}</span>
          <textarea
            data-testid="chat-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="외교 메시지를 입력하세요"
            maxLength={4_000}
          />
        </label>
        <button
          className="primary_button"
          data-testid="send-chat"
          type="submit"
          disabled={busy || selectedNationIds.length === 0}
        >
          {busy ? "회담 연결 중…" : "메시지 전송"}
        </button>
      </form>
    </section>
  );
};
