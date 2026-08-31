import { useState } from "react";

import type { Campaign, TimelineCadence } from "../../state/campaign-store";
import { TimelineNews } from "./TimelineNews";
import { TimelineProcessedEventList } from "./TimelineProcessedEventList";

interface TimelinePanelProps {
  readonly campaign: Campaign;
  readonly onJump: (cadence: TimelineCadence) => Promise<boolean>;
  readonly onSave: () => Promise<boolean>;
}

export const TimelinePanel = ({ campaign, onJump, onSave }: TimelinePanelProps): JSX.Element => {
  const [selectedEventIndex, setSelectedEventIndex] = useState(() =>
    Math.max(0, campaign.resolutions.length - 1),
  );
  const [intervention, setIntervention] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [cadence, setCadence] = useState<"week" | "month" | "quarter" | "year" | "major">(
    "quarter",
  );
  const [queuedEvents, setQueuedEvents] = useState<readonly string[]>([
    "의회 예산안 검토",
    "국경 교역 보고",
    "산업화 촉매의 기회",
  ]);
  const [activeCatalysts, setActiveCatalysts] = useState<readonly string[]>([]);
  const [simulationSaveStatus, setSimulationSaveStatus] = useState<string | null>(null);
  const selectedEvent = campaign.resolutions[selectedEventIndex]?.article.headlineKo;

  const submitIntervention = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedIntervention = intervention.trim();
    if (selectedEvent === undefined || trimmedIntervention.length === 0) {
      return;
    }
    setResult(
      `"${selectedEvent}" 사건에 "${trimmedIntervention}" 개입이 다음 확정 대기열에 추가되었습니다.`,
    );
    setQueuedEvents((current) => [...current, `개입: ${trimmedIntervention}`]);
    setIntervention("");
  };

  const jump = async (): Promise<void> => {
    const labels = {
      week: "1주",
      month: "1개월",
      quarter: "1분기",
      year: "1년",
      major: "다음 주요 사건",
    } as const;
    if (await onJump(cadence)) {
      setResult(`${labels[cadence]} 시간 이동을 확정했습니다.`);
    }
  };

  const activateCatalyst = (): void => {
    const catalyst = "산업화 촉매";
    if (activeCatalysts.includes(catalyst)) {
      return;
    }
    setActiveCatalysts((current) => [...current, catalyst]);
    setQueuedEvents((current) => [...current, `${catalyst} 활성화`]);
    setResult(`${catalyst}가 다음 사건 흐름에 활성화되었습니다.`);
  };

  const activateStoryline = (): void => {
    const storyline = "대륙 교역 이야기";
    if (activeCatalysts.includes(storyline)) {
      return;
    }
    setActiveCatalysts((current) => [...current, storyline]);
    setQueuedEvents((current) => [...current, `${storyline} 시작`]);
    setResult(`${storyline}을 시작했습니다.`);
  };

  return (
    <section className="panel_section timeline_panel" data-testid="timeline-panel">
      <div className="timeline_panel_heading">
        <div>
          <span className="eyebrow">가변 연대기</span>
          <h3>사건 개입</h3>
        </div>
        <span className="status_pill">초안</span>
      </div>
      <p className="timeline_helper">
        확정 기록을 선택하면 다음 턴에 반영할 개입 초안을 만들 수 있습니다.
      </p>
      <TimelineNews
        campaign={campaign}
        selectedResolutionIndex={selectedEventIndex}
        onSelectResolutionIndex={setSelectedEventIndex}
      />
      <fieldset className="timeline_jump_controls">
        <legend>추가 시간 이동</legend>
        <label className="field">
          <span>시간 이동</span>
          <select
            data-testid="timeline-cadence"
            value={cadence}
            onChange={(event) => {
              switch (event.target.value) {
                case "week":
                case "month":
                case "quarter":
                case "year":
                case "major":
                  setCadence(event.target.value);
                  break;
                default:
                  setCadence("quarter");
              }
            }}
          >
            <option value="week">1주</option>
            <option value="month">1개월</option>
            <option value="quarter">1분기</option>
            <option value="year">1년</option>
            <option value="major">다음 주요 사건</option>
          </select>
        </label>
        <button
          className="secondary_button"
          data-testid="timeline-jump"
          type="button"
          onClick={jump}
        >
          시간 이동 검토
        </button>
        <button
          className="quiet_button"
          data-testid="timeline-save"
          type="button"
          onClick={async () => {
            if (await onSave()) {
              setSimulationSaveStatus(`턴 ${campaign.turn} 시뮬레이션 상태를 저장했습니다.`);
            }
          }}
        >
          시뮬레이션 저장
        </button>
      </fieldset>
      <TimelineProcessedEventList
        resolutions={campaign.resolutions}
        selectedIndex={selectedEventIndex}
        onSelect={setSelectedEventIndex}
      />
      <section className="queued_events" aria-labelledby="queued-events-title">
        <div className="timeline_subheading">
          <h4 id="queued-events-title">대기 사건 검토</h4>
          <span data-testid="queued-event-count">{queuedEvents.length}</span>
        </div>
        {queuedEvents.length === 0 ? (
          <p>검토할 대기 사건이 없습니다.</p>
        ) : (
          <ul data-testid="queued-event-list">
            {queuedEvents.map((event, index) => (
              <li key={event}>
                <span>{event}</span>
                <button
                  className="quiet_button"
                  data-testid={`delete-queued-event-${index}`}
                  type="button"
                  onClick={() =>
                    setQueuedEvents((current) => current.filter((_, i) => i !== index))
                  }
                >
                  삭제
                </button>
                <button
                  className="quiet_button"
                  data-testid={`discard-queued-event-${index}`}
                  type="button"
                  onClick={() => {
                    setQueuedEvents((current) => current.filter((_, i) => i !== index));
                    setResult(`"${event}" 사건을 폐기했습니다.`);
                  }}
                >
                  폐기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="timeline_intervention_form" onSubmit={submitIntervention}>
        <label className="field">
          <span>개입 메모</span>
          <textarea
            data-testid="timeline-intervention-input"
            value={intervention}
            onChange={(event) => setIntervention(event.target.value)}
            placeholder="예: 의회가 예산 집행을 재검토한다."
            disabled={selectedEvent === undefined}
            maxLength={1_000}
          />
        </label>
        <button
          className="secondary_button"
          data-testid="intervene-timeline"
          type="submit"
          disabled={selectedEvent === undefined || intervention.trim().length === 0}
        >
          개입 초안 만들기
        </button>
      </form>
      <fieldset className="timeline_story_controls">
        <legend>촉매와 이야기</legend>
        <button
          className="secondary_button"
          data-testid="activate-catalyst"
          type="button"
          onClick={activateCatalyst}
        >
          촉매 활성화
        </button>
        <button
          className="secondary_button"
          data-testid="activate-storyline"
          type="button"
          onClick={activateStoryline}
        >
          이야기 시작
        </button>
        <span data-testid="active-storylines">
          {activeCatalysts.length === 0 ? "활성 흐름 없음" : activeCatalysts.join(" · ")}
        </span>
      </fieldset>
      {simulationSaveStatus !== null ? (
        <p className="timeline_result" data-testid="timeline-save-status" role="status">
          {simulationSaveStatus}
        </p>
      ) : null}
      {result !== null ? (
        <p className="timeline_result" data-testid="timeline-intervention-result" role="status">
          {result}
        </p>
      ) : null}
    </section>
  );
};
