import { type FormEvent, useState } from "react";

import type { Campaign } from "../../state/campaign-store";
import type { CampaignChatRoom } from "./campaign-chat-rooms";

interface CampaignChatRoomThreadProps {
  readonly campaign: Campaign;
  readonly room: CampaignChatRoom | undefined;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly targetNationId: string;
  readonly busy: boolean;
  readonly startingNew: boolean;
  readonly onBack: () => void;
  readonly onChangeTarget: (nationId: string) => void;
  readonly onSendChat: (targetNationId: string, message: string) => Promise<boolean>;
}

export const CampaignChatRoomThread = ({
  campaign,
  room,
  nationNameById,
  targetNationId,
  busy,
  startingNew,
  onBack,
  onChangeTarget,
  onSendChat,
}: CampaignChatRoomThreadProps): JSX.Element => {
  const [message, setMessage] = useState("");
  const targetNations = campaign.nations.filter((nation) => nation.id !== campaign.playerNationId);
  const targetName = nationNameById.get(targetNationId) ?? targetNationId;

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || targetNationId.length === 0) {
      return;
    }
    if (await onSendChat(targetNationId, trimmedMessage)) {
      setMessage("");
    }
  };

  return (
    <section className="chat_thread" aria-label={`${targetName} 외교 대화`}>
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
            <span>{targetName}</span>
          </div>
        </div>
        {startingNew ? (
          <label className="field chat_thread_target">
            <span>대화 상대</span>
            <select
              data-testid="chat-target"
              value={targetNationId}
              onChange={(event) => onChangeTarget(event.target.value)}
            >
              {targetNations.map((nation) => (
                <option key={nation.id} value={nation.id}>
                  {nation.nameKo}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <ul className="chat_thread_messages" data-testid="chat-room-thread" aria-live="polite">
        {room?.messages.map((entry) => (
          <li
            className={`chat_message chat_message_${entry.role}`}
            data-testid={entry.role === "counterpart" ? "chat-reply" : "chat-player-message"}
            data-topic={entry.topic}
            data-intent={entry.intent}
            key={entry.id}
          >
            <span className="chat_message_meta">
              {entry.role === "player"
                ? "플레이어"
                : (nationNameById.get(entry.speakerNationId) ?? entry.speakerNationId)}{" "}
              · 턴 {entry.turn}
            </span>
            <span>{entry.text}</span>
          </li>
        )) ?? <li className="chat_empty">첫 메시지로 외교 채팅을 시작하세요.</li>}
      </ul>
      <form className="chat_composer" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>{targetName}에 보낼 메시지</span>
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
          disabled={busy || targetNationId.length === 0}
        >
          {busy ? "회담 연결 중…" : "메시지 전송"}
        </button>
      </form>
    </section>
  );
};
