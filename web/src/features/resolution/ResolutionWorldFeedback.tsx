import { useEffect, useState } from "react";

import {
  type Campaign,
  type CampaignResolution,
  useCampaignStore,
} from "../../state/campaign-store";
import "./processed-news.css";

type CampaignWorldEvent = Campaign["worldEvents"][number];
type CampaignNationReaction = Campaign["nationReactions"][number];

interface ResolutionWorldFeedbackProps {
  readonly resolution: CampaignResolution;
  readonly nationNameById: ReadonlyMap<string, string>;
}

interface WorldEventCardProps {
  readonly event: CampaignWorldEvent;
  readonly nationNameById: ReadonlyMap<string, string>;
}

interface ReactionCardProps {
  readonly reaction: CampaignNationReaction;
  readonly order: number;
  readonly nationNameById: ReadonlyMap<string, string>;
}

const sentimentFormatter = new Intl.NumberFormat("ko-KR", { signDisplay: "exceptZero" });

const importanceLabels: Readonly<Record<CampaignWorldEvent["importance"], string>> = Object.freeze({
  minor: "일반 사건",
  major: "중대 사건",
});

const kindLabels: Readonly<Record<CampaignWorldEvent["kind"], string>> = Object.freeze({
  economic: "경제",
  diplomatic: "외교",
  military: "군사",
  political: "정치",
});

const stanceLabels: Readonly<Record<CampaignNationReaction["stance"], string>> = Object.freeze({
  supportive: "지지",
  cautious: "신중",
  opposed: "반대",
  neutral: "중립",
});

const WorldEventCard = ({ event, nationNameById }: WorldEventCardProps): JSX.Element => (
  <article
    className="world_event"
    data-testid="resolution-world-event"
    data-event-id={event.id}
    data-importance={event.importance}
    data-kind={event.kind}
  >
    <div className="world_event_meta">
      <span className="world_event_importance">{importanceLabels[event.importance]}</span>
      <span className="world_event_kind">{kindLabels[event.kind]}</span>
    </div>
    <strong className="world_event_headline" data-testid="resolution-world-event-headline">
      {event.headlineKo}
    </strong>
    <p className="world_event_summary" data-testid="resolution-world-event-summary">
      {event.summaryKo}
    </p>
    <ul className="world_event_nations" aria-label="사건의 영향을 받은 국가">
      {event.affectedNationIds.map((nationId) => (
        <li key={nationId} data-testid="resolution-world-event-nation" data-nation-id={nationId}>
          {nationNameById.get(nationId) ?? nationId}
        </li>
      ))}
    </ul>
  </article>
);

const ReactionCard = ({ reaction, order, nationNameById }: ReactionCardProps): JSX.Element => (
  <article
    className="reaction_card"
    data-testid="resolution-reaction"
    data-nation-id={reaction.nationId}
    data-stance={reaction.stance}
    data-reaction-order={order}
  >
    <span className="reaction_order" aria-hidden="true">
      {order}
    </span>
    <div className="reaction_copy">
      <div className="reaction_head">
        <strong data-testid="resolution-reaction-nation">
          {nationNameById.get(reaction.nationId) ?? reaction.nationId}
        </strong>
        <span className="reaction_stance">{stanceLabels[reaction.stance]}</span>
        <span className="reaction_sentiment">
          {sentimentFormatter.format(reaction.sentimentBps)}bp
        </span>
      </div>
      <p data-testid="resolution-reaction-statement">{reaction.statementKo}</p>
    </div>
  </article>
);

export const ResolutionWorldFeedback = ({
  resolution,
  nationNameById,
}: ResolutionWorldFeedbackProps): JSX.Element | null => {
  const worldEvents = useCampaignStore((state) => state.campaign?.worldEvents);
  const nationReactions = useCampaignStore((state) => state.campaign?.nationReactions);
  const events = resolution.worldEventIds.flatMap(
    (eventId) => worldEvents?.find((candidate) => candidate.id === eventId) ?? [],
  );
  const reactions = resolution.reactionIds.flatMap(
    (reactionId) => nationReactions?.find((candidate) => candidate.id === reactionId) ?? [],
  );

  // Staged reveal (Open Historia pattern): events surface one at a time so a
  // multi-event turn reads as history unfolding, not a dump. Reactions wait
  // until the last event is on screen.
  const [revealedCount, setRevealedCount] = useState(1);
  useEffect(() => {
    setRevealedCount(1);
  }, [resolution.id]);

  if (events.length === 0) {
    return null;
  }

  const visibleEvents = events.slice(0, Math.max(1, revealedCount));
  const allRevealed = visibleEvents.length >= events.length;

  return (
    <section
      className="resolution_feedback"
      aria-labelledby={`feedback-${resolution.id}`}
      data-testid="resolution-world-feedback"
      data-revealed-events={visibleEvents.length}
      data-total-events={events.length}
    >
      <h3 id={`feedback-${resolution.id}`}>세계 반향</h3>
      {visibleEvents.map((event) => (
        <WorldEventCard key={event.id} event={event} nationNameById={nationNameById} />
      ))}
      {allRevealed ? null : (
        <button
          type="button"
          className="reveal_next_event"
          data-testid="reveal-next-event"
          onClick={() => setRevealedCount((count) => count + 1)}
        >
          다음 사건 공개 ({visibleEvents.length}/{events.length})
        </button>
      )}
      {reactions.length === 0 || !allRevealed ? null : (
        <div
          className="reaction_grid"
          data-testid="resolution-reactions"
          data-reaction-count={reactions.length}
        >
          {reactions.map((reaction, index) => (
            <ReactionCard
              key={reaction.id}
              reaction={reaction}
              order={index + 1}
              nationNameById={nationNameById}
            />
          ))}
        </div>
      )}
    </section>
  );
};
