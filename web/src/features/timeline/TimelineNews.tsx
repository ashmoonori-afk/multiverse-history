import type { Campaign } from "../../state/campaign-store";
import { ResolutionArticle } from "../resolution/ResolutionArticle";
import "./timeline-news.css";

interface TimelineNewsProps {
  readonly campaign: Campaign;
  readonly selectedResolutionIndex: number;
  readonly onSelectResolutionIndex: (index: number) => void;
}

export const TimelineNews = ({
  campaign,
  selectedResolutionIndex,
  onSelectResolutionIndex,
}: TimelineNewsProps): JSX.Element => {
  const selectedResolution = campaign.resolutions[selectedResolutionIndex];
  const nationNameById = new Map(campaign.nations.map((nation) => [nation.id, nation.nameKo]));

  return (
    <section className="timeline_news" aria-labelledby="timeline-news-title">
      <div className="timeline_subheading">
        <div>
          <span className="eyebrow">확정된 역사</span>
          <h4 id="timeline-news-title">행동이 만든 뉴스</h4>
        </div>
        <span>{campaign.resolutions.length}건</span>
      </div>
      {campaign.resolutions.length === 0 ? (
        <p>행동을 확정하면 역사 변화가 기사로 쌓입니다.</p>
      ) : selectedResolution === undefined ? null : (
        <>
          <div className="timeline_news_list" data-testid="timeline-news-list">
            <ResolutionArticle
              resolution={selectedResolution}
              playerNationId={campaign.playerNationId}
              nationNameById={nationNameById}
              headingLevel={5}
            />
          </div>
          <nav className="timeline_news_navigation" aria-label="확정된 역사 기사 이동">
            <button
              className="quiet_button"
              type="button"
              data-testid="previous-resolution"
              disabled={selectedResolutionIndex === 0}
              onClick={() => onSelectResolutionIndex(Math.max(0, selectedResolutionIndex - 1))}
            >
              이전 사건
            </button>
            <span>
              {selectedResolutionIndex + 1} / {campaign.resolutions.length}
            </span>
            <button
              className="primary_button"
              type="button"
              data-testid="next-resolution"
              disabled={selectedResolutionIndex >= campaign.resolutions.length - 1}
              onClick={() =>
                onSelectResolutionIndex(
                  Math.min(campaign.resolutions.length - 1, selectedResolutionIndex + 1),
                )
              }
            >
              다음 사건
            </button>
          </nav>
        </>
      )}
    </section>
  );
};
