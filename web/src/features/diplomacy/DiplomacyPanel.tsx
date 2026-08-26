import { useState } from "react";

import type { Campaign, TreatyClause } from "../../state/campaign-store";

interface DiplomacyPanelProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly onSelectNation: (nationId: string) => void;
  readonly busy: boolean;
  readonly onProposeTreaty: (targetNationId: string, clause: TreatyClause) => Promise<boolean>;
  readonly onTransferTerritory: (targetNationId: string, provinceId: string) => Promise<boolean>;
  readonly onDeclareWar: (targetNationId: string) => Promise<boolean>;
}

interface ChatMessage {
  readonly id: string;
  readonly speaker: string;
  readonly text: string;
}

type ExtendedProposal = TreatyClause | "peace" | "threat" | "ultimatum";
type ChatScope = "private" | "group";
type AdvisorQuestion = "preset" | "custom";
const proposalLabels: Readonly<Record<ExtendedProposal, string>> = {
  alliance: "동맹",
  non_aggression: "불가침",
  trade: "통상",
  military_access: "군사 통행",
  peace: "평화",
  threat: "위협",
  ultimatum: "최후통첩",
};

export const DiplomacyPanel = ({
  campaign,
  nationNameById,
  onSelectNation,
  busy,
  onProposeTreaty,
  onTransferTerritory,
  onDeclareWar,
}: DiplomacyPanelProps): JSX.Element => {
  const targetNations = campaign.nations.filter((nation) => nation.id !== campaign.playerNationId);
  const [targetNationId, setTargetNationId] = useState(targetNations[0]?.id ?? "");
  const [diplomacyTargetId, setDiplomacyTargetId] = useState(
    targetNations[1]?.id ?? targetNations[0]?.id ?? "",
  );
  const [warTargetId, setWarTargetId] = useState(
    targetNations[1]?.id ?? targetNations[0]?.id ?? "",
  );
  const ownedProvinces = campaign.provinces.filter(
    (province) => province.ownerNationId === campaign.playerNationId,
  );
  const [transferProvinceId, setTransferProvinceId] = useState(ownedProvinces[0]?.id ?? "");
  const [clause, setClause] = useState<ExtendedProposal>("trade");
  const [chatScope, setChatScope] = useState<ChatScope>("private");
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<readonly ChatMessage[]>([]);
  const [advisorSuggestion, setAdvisorSuggestion] = useState<string | null>(null);
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [advisorMode, setAdvisorMode] = useState<AdvisorQuestion>("preset");
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const targetNation = targetNations.find((nation) => nation.id === targetNationId);
  const targetName = nationNameById.get(targetNationId) ?? (targetNationId || "상대 국가");
  const warBlocked = campaign.treaties.some(
    (treaty) =>
      treaty.status === "active" &&
      [treaty.proposerNationId, treaty.recipientNationId].includes(campaign.playerNationId) &&
      [treaty.proposerNationId, treaty.recipientNationId].includes(warTargetId) &&
      treaty.clauses.some(
        (candidate) => candidate === "alliance" || candidate === "non_aggression",
      ),
  );
  const latestWar = [...campaign.wars].reverse()[0];

  const sendMessage = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || targetNation === undefined) {
      return;
    }
    setChatLog((current) => {
      const messageId = String(current.length);
      const playerName =
        campaign.nations.find((nation) => nation.id === campaign.playerNationId)?.nameKo ??
        campaign.playerNationId;
      return [
        ...current,
        {
          id: `${messageId}-player`,
          speaker: chatScope === "group" ? `${playerName} 공동 회의` : playerName,
          text: trimmedMessage,
        },
        {
          id: `${messageId}-reply`,
          speaker: chatScope === "group" ? "외교 회의실" : targetNation.nameKo,
          text: `${targetNation.nameKo} 측은 제안을 검토한 뒤 다음 회담에서 답하겠다고 전했습니다.`,
        },
      ];
    });
    setMessage("");
  };

  return (
    <section className="panel_section diplomacy_panel" data-testid="diplomacy-chat">
      <div className="diplomacy_panel_heading">
        <div>
          <span className="eyebrow">외교 통신</span>
          <h3>대화와 조언</h3>
        </div>
        <span className="status_pill">결정 전</span>
      </div>
      <label className="field">
        <span>대화 상대</span>
        <select
          data-testid="diplomacy-chat-target"
          value={targetNationId}
          onChange={(event) => {
            setTargetNationId(event.target.value);
            onSelectNation(event.target.value);
          }}
        >
          {targetNations.map((nation) => (
            <option key={nation.id} value={nation.id}>
              {nation.nameKo}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>대화 채널</span>
        <select
          data-testid="diplomacy-chat-scope"
          value={chatScope}
          onChange={(event) => setChatScope(event.target.value as ChatScope)}
        >
          <option value="private">비공개 회담</option>
          <option value="group">다자 외교 회의</option>
        </select>
      </label>
      <div className="diplomacy_action_grid">
        <label className="field">
          <span>협정 대상</span>
          <select
            data-testid="diplomacy-target"
            value={diplomacyTargetId}
            onChange={(event) => setDiplomacyTargetId(event.target.value)}
          >
            {targetNations.map((nation) => (
              <option key={nation.id} value={nation.id}>
                {nation.nameKo}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>조항</span>
          <select
            data-testid="diplomacy-clause"
            value={clause}
            onChange={(event) => setClause(event.target.value as ExtendedProposal)}
          >
            <option value="alliance">동맹</option>
            <option value="non_aggression">불가침</option>
            <option value="trade">통상</option>
            <option value="military_access">군사 통행</option>
            <option value="peace">평화 제안</option>
            <option value="threat">위협</option>
            <option value="ultimatum">최후통첩</option>
          </select>
        </label>
      </div>
      <button
        className="secondary_button"
        data-testid="propose-treaty"
        type="button"
        disabled={busy}
        onClick={() => {
          if (
            clause === "alliance" ||
            clause === "non_aggression" ||
            clause === "trade" ||
            clause === "military_access"
          ) {
            void onProposeTreaty(diplomacyTargetId, clause);
            return;
          }
          setProposalStatus(
            `${targetName}에 ${proposalLabels[clause]} 제안을 외교 대기열에 기록했습니다.`,
          );
        }}
      >
        협정 제안
      </button>
      <div className="diplomacy_action_grid">
        <label className="field">
          <span>이전 지역</span>
          <select
            data-testid="transfer-province"
            value={transferProvinceId}
            onChange={(event) => setTransferProvinceId(event.target.value)}
          >
            {ownedProvinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.id}
              </option>
            ))}
          </select>
        </label>
        <button
          className="quiet_button"
          data-testid="transfer-territory"
          type="button"
          disabled={busy || transferProvinceId.length === 0}
          onClick={async () => {
            if (await onTransferTerritory(diplomacyTargetId, transferProvinceId)) {
              setProposalStatus(`${targetName}에 ${transferProvinceId} 지역을 이전했습니다.`);
            }
          }}
        >
          영토 이전
        </button>
      </div>
      {proposalStatus !== null ? (
        <p className="war_status" data-testid="diplomacy-proposal-status" role="status">
          {proposalStatus}
        </p>
      ) : null}
      <div className="diplomacy_action_grid">
        <label className="field">
          <span>전쟁 대상</span>
          <select
            data-testid="war-target"
            value={warTargetId}
            onChange={(event) => setWarTargetId(event.target.value)}
          >
            {targetNations.map((nation) => (
              <option key={nation.id} value={nation.id}>
                {nation.nameKo}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary_button"
          data-testid="declare-war"
          type="button"
          disabled={busy || warBlocked}
          onClick={() => void onDeclareWar(warTargetId)}
        >
          전쟁 선포
        </button>
      </div>
      <p className="war_status" data-testid="war-status" role="status">
        {latestWar === undefined
          ? "전쟁을 선포하면 이곳에 상태가 기록됩니다."
          : `전쟁 상태: ${nationNameById.get(latestWar.targetNationId) ?? latestWar.targetNationId}`}
      </p>
      <form className="diplomacy_chat_composer" onSubmit={sendMessage}>
        <label className="field">
          <span>메시지</span>
          <textarea
            data-testid="diplomacy-chat-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`${targetName}에 보낼 외교 메시지`}
            maxLength={1_000}
          />
        </label>
        <button className="secondary_button" data-testid="send-diplomacy-chat" type="submit">
          메시지 전송
        </button>
      </form>
      <ul className="diplomacy_chat_log" data-testid="diplomacy-chat-log" aria-live="polite">
        {chatLog.length === 0 ? (
          <li className="diplomacy_empty">첫 메시지를 보내면 회담 기록이 쌓입니다.</li>
        ) : (
          chatLog.map((entry) => (
            <li
              className={
                entry.speaker === "대한제국"
                  ? "diplomacy_message_player"
                  : "diplomacy_message_counterpart"
              }
              key={entry.id}
            >
              <strong>{entry.speaker}</strong>
              <span>{entry.text}</span>
            </li>
          ))
        )}
      </ul>
      <div className="advisor_card">
        <div>
          <span className="eyebrow">궁정 고문</span>
          <p data-testid="advisor-suggestion">
            {advisorSuggestion ?? "현재 관계와 국고를 바탕으로 다음 외교 수를 제안합니다."}
          </p>
        </div>
        <label className="field">
          <span>질문 유형</span>
          <select
            data-testid="advisor-question-mode"
            value={advisorMode}
            onChange={(event) => setAdvisorMode(event.target.value as AdvisorQuestion)}
          >
            <option value="preset">추천 질문</option>
            <option value="custom">직접 질문</option>
          </select>
        </label>
        {advisorMode === "custom" ? (
          <input
            className="advisor_question_input"
            data-testid="advisor-custom-question"
            value={advisorQuestion}
            onChange={(event) => setAdvisorQuestion(event.target.value)}
            placeholder="고문에게 물어볼 질문"
            maxLength={500}
          />
        ) : null}
        <button
          className="secondary_button"
          data-testid="advisor-assist"
          type="button"
          onClick={() => {
            const question = advisorQuestion.trim();
            setAdvisorSuggestion(
              advisorMode === "custom" && question.length > 0
                ? `질문 "${question}"에 대한 고문 답변: ${targetName}과 먼저 통상 조건을 맞추고 다음 분기까지 관계 변화를 관찰하세요.`
                : `${targetName}과 먼저 통상 조건을 맞추고, ${campaign.turn + 1}분기까지 관계 변화를 관찰하세요.`,
            );
          }}
        >
          조언 받기
        </button>
      </div>
    </section>
  );
};
