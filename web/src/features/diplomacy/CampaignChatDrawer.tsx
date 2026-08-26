import { type FormEvent, useState } from "react";

import type { Campaign } from "../../state/campaign-store";

interface CampaignChatDrawerProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSendChat: (targetNationId: string, message: string) => Promise<boolean>;
}

export const CampaignChatDrawer = ({
  campaign,
  nationNameById,
  busy,
  onClose,
  onSendChat,
}: CampaignChatDrawerProps): JSX.Element => {
  const targetNations = campaign.nations.filter((nation) => nation.id !== campaign.playerNationId);
  const [targetNationId, setTargetNationId] = useState(targetNations[0]?.id ?? "");
  const [message, setMessage] = useState("");
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
    <aside className="chat_drawer" aria-label="외교 채팅" data-testid="chat-drawer">
      <div className="chat_drawer_heading">
        <div>
          <span className="eyebrow">상시 외교 통신</span>
          <h2>협상 채팅</h2>
        </div>
        <button className="quiet_button" data-testid="close-chat" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
      <label className="field">
        <span>대화 상대</span>
        <select
          data-testid="chat-target"
          value={targetNationId}
          onChange={(event) => setTargetNationId(event.target.value)}
        >
          {targetNations.map((nation) => (
            <option key={nation.id} value={nation.id}>
              {nation.nameKo}
            </option>
          ))}
        </select>
      </label>
      <ul className="chat_history" data-testid="chat-history" aria-live="polite">
        {campaign.chatMessages.length === 0 ? (
          <li className="chat_empty">메시지를 보내면 회담 기록이 이곳에 남습니다.</li>
        ) : (
          campaign.chatMessages.map((entry) => (
            <li
              className={`chat_message chat_message_${entry.role}`}
              data-testid={entry.role === "counterpart" ? "chat-reply" : undefined}
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
          ))
        )}
      </ul>
      <form className="chat_composer" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>{targetName}에 보낼 메시지</span>
          <textarea
            data-testid="chat-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="협상 선택지를 물어보세요"
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
    </aside>
  );
};
