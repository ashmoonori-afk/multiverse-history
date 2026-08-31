import type { CampaignResolution } from "../../state/campaign-store";
import { ResolutionArticle } from "./ResolutionArticle";

type TurnResultPanelProps =
  | {
      readonly state: "resolving";
    }
  | {
      readonly state: "committed";
      readonly resolution: CampaignResolution;
      readonly playerNationId: string;
      readonly nationNameById: ReadonlyMap<string, string>;
      readonly onContinue: () => void;
    };

const ResultSkeleton = (): JSX.Element => (
  <section
    className="turn_result_loading"
    data-testid="campaign-result-loading"
    aria-live="polite"
    aria-label="행동 결과 계산 중"
  >
    <header>
      <span>타임라인 계산 중</span>
      <strong>선택한 행동이 역사에 미치는 영향을 추적하고 있습니다.</strong>
    </header>
    <div className="result_skeleton_card">
      <span className="result_skeleton result_skeleton_meta" />
      <span className="result_skeleton result_skeleton_title" />
      <span className="result_skeleton result_skeleton_line" />
      <span className="result_skeleton result_skeleton_line" />
      <span className="result_skeleton result_skeleton_short" />
    </div>
    <div className="result_skeleton_card">
      <span className="result_skeleton result_skeleton_meta" />
      <span className="result_skeleton result_skeleton_line" />
      <span className="result_skeleton result_skeleton_line" />
    </div>
  </section>
);

export const TurnResultPanel = (props: TurnResultPanelProps): JSX.Element => {
  switch (props.state) {
    case "resolving":
      return <ResultSkeleton />;
    case "committed":
      return (
        <section className="campaign_result_panel" data-testid="campaign-result-panel">
          <header className="campaign_result_heading">
            <div>
              <strong data-testid="resolution-summary">최근 확정 결과</strong>
              <span>선택한 행동 이후 달라진 역사</span>
            </div>
          </header>
          <ResolutionArticle
            resolution={props.resolution}
            playerNationId={props.playerNationId}
            nationNameById={props.nationNameById}
          />
          <button
            className="primary_button result_continue"
            type="button"
            data-testid="result-continue"
            onClick={props.onContinue}
          >
            다음 행동 계획하기
          </button>
        </section>
      );
  }
};
