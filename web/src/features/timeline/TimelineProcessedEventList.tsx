import type { CampaignResolution } from "../../state/campaign-store";

interface TimelineProcessedEventListProps {
  readonly resolutions: readonly CampaignResolution[];
  readonly selectedIndex: number | null;
  readonly onSelect: (index: number) => void;
}

export const TimelineProcessedEventList = ({
  resolutions,
  selectedIndex,
  onSelect,
}: TimelineProcessedEventListProps): JSX.Element => (
  <ol className="timeline_event_list">
    {resolutions.length === 0 ? (
      <li>확정된 사건이 없습니다.</li>
    ) : (
      resolutions.map((resolution, index) => (
        <li key={resolution.id}>
          <button
            className="timeline_event_button"
            data-testid={`timeline-event-${index}`}
            type="button"
            aria-pressed={selectedIndex === index}
            onClick={() => onSelect(index)}
          >
            <span>
              기록 {index + 1} · {resolution.timestampKo}
            </span>
            <strong>{resolution.article.headlineKo}</strong>
            <small>{resolution.article.ledeKo}</small>
          </button>
        </li>
      ))
    )}
  </ol>
);
