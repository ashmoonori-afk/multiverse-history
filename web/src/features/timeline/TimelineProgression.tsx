import { useState } from "react";

import type { Campaign } from "../../state/campaign-store";
import "./timeline-progression.css";

export type TimelineProgressionRequest =
  | { readonly mode: "months"; readonly months: number }
  | { readonly mode: "until_major_event" };

interface TimelineProgressionProps {
  readonly campaign: Campaign;
  readonly onProgression?:
    | ((progression: TimelineProgressionRequest) => Promise<boolean>)
    | undefined;
}

type ProgressionResult = NonNullable<Campaign["lastProgression"]>;
type ProgressionMode = ProgressionResult["mode"];

const LONG_HORIZON_MONTHS = 18;

const dayFormatter = new Intl.NumberFormat("ko-KR");

const modeLabels: Readonly<Record<ProgressionMode, string>> = {
  months: "개월 단위 진행",
  until_major_event: "주요 사건까지",
};

const pendingLabels: Readonly<Record<ProgressionMode, string>> = {
  months: `${LONG_HORIZON_MONTHS}개월 진행 중`,
  until_major_event: "다음 주요 사건까지 진행 중",
};

const stopReasonLabels: Readonly<Record<ProgressionResult["stopReason"], string>> = {
  requested_duration: "요청한 기간을 모두 진행했습니다.",
  major_event: "주요 사건이 발생해 진행을 멈췄습니다.",
  horizon_reached: "최대 진행 지평에 도달해 멈췄습니다.",
};

export const TimelineProgression = ({
  campaign,
  onProgression,
}: TimelineProgressionProps): JSX.Element => {
  const [pendingMode, setPendingMode] = useState<ProgressionMode | null>(null);
  const progression = campaign.lastProgression;
  const majorEvent =
    progression?.majorEventId === undefined
      ? undefined
      : campaign.worldEvents.find((event) => event.id === progression.majorEventId);

  const requestProgression = async (request: TimelineProgressionRequest): Promise<void> => {
    if (onProgression === undefined) {
      return;
    }
    setPendingMode(request.mode);
    try {
      await onProgression(request);
    } finally {
      setPendingMode(null);
    }
  };

  const busy = pendingMode !== null;
  const controlsDisabled = busy || onProgression === undefined;

  return (
    <fieldset className="timeline_progression" aria-busy={busy} data-busy={busy}>
      <legend>장기 진행</legend>
      <p className="timeline_progression_helper">
        확정된 사건 이후의 세계를 길게 진행합니다. 최대 18개월까지 진행하거나 다음 주요 사건에서
        자동으로 멈춥니다.
      </p>
      <div className="timeline_progression_actions">
        <button
          className="secondary_button"
          data-testid="progress-18-months"
          type="button"
          disabled={controlsDisabled}
          onClick={() => requestProgression({ mode: "months", months: LONG_HORIZON_MONTHS })}
        >
          18개월
        </button>
        <button
          className="secondary_button"
          data-testid="progress-until-major-event"
          type="button"
          disabled={controlsDisabled}
          onClick={() => requestProgression({ mode: "until_major_event" })}
        >
          다음 주요 사건까지
        </button>
      </div>
      {pendingMode === null ? null : (
        <p className="timeline_progression_pending" role="status">
          <span className="timeline_progression_track" aria-hidden="true" />
          {pendingLabels[pendingMode]}
        </p>
      )}
      {onProgression === undefined ? (
        <p className="timeline_progression_helper" data-testid="timeline-progression-unavailable">
          장기 진행 연결이 아직 준비되지 않았습니다.
        </p>
      ) : null}
      {progression === null ? null : (
        <div
          className="timeline_progression_result"
          data-testid="timeline-progression-mode"
          data-progression-mode={progression.mode}
          data-progression-steps={progression.steps}
          data-advance-days={progression.advanceDays}
          data-stop-reason={progression.stopReason}
          role="status"
        >
          <dl className="timeline_progression_metrics">
            <div>
              <dt>진행 방식</dt>
              <dd>{modeLabels[progression.mode]}</dd>
            </div>
            <div>
              <dt>진행 단계</dt>
              <dd>{progression.steps}단계</dd>
            </div>
            <div>
              <dt>경과 일수</dt>
              <dd>{dayFormatter.format(progression.advanceDays)}일</dd>
            </div>
          </dl>
          <p className="timeline_progression_reason">{stopReasonLabels[progression.stopReason]}</p>
          {majorEvent === undefined ? null : (
            <article
              className="timeline_progression_event"
              data-testid="timeline-progression-major-event"
            >
              <span>
                {majorEvent.date.year}년 {majorEvent.date.quarter}분기 · 주요 사건
              </span>
              <strong>{majorEvent.headlineKo}</strong>
              <small>{majorEvent.summaryKo}</small>
            </article>
          )}
        </div>
      )}
    </fieldset>
  );
};
