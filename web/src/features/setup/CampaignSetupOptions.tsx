import type { CampaignDifficulty, PlannerProvider } from "../../state/campaign-store";

const difficultyLabels = {
  story: "이야기",
  standard: "표준",
  hard: "어려움",
} as const;

const modelLabels = {
  deterministic: "규칙 기반",
  codex: "Codex",
  claude: "Claude",
} as const;

interface CampaignSetupOptionsProps {
  readonly provider: PlannerProvider;
  readonly onProviderChange: (provider: PlannerProvider) => void;
  readonly customPolityEnabled: boolean;
  readonly customPolityName: string;
  readonly onCustomPolityEnabledChange: (enabled: boolean) => void;
  readonly onCustomPolityNameChange: (name: string) => void;
  readonly difficulty: CampaignDifficulty;
  readonly onDifficultyChange: (difficulty: CampaignDifficulty) => void;
}

export const CampaignSetupOptions = ({
  provider,
  onProviderChange,
  customPolityEnabled,
  customPolityName,
  onCustomPolityEnabledChange,
  onCustomPolityNameChange,
  difficulty,
  onDifficultyChange,
}: CampaignSetupOptionsProps): JSX.Element => {
  const polityName = customPolityEnabled && customPolityName.trim() ? customPolityName : "대한제국";

  return (
    <section className="campaign_setup_options" aria-labelledby="setup-options-title">
      <div className="campaign_setup_heading">
        <div>
          <span className="eyebrow">시작 설정</span>
          <h2 id="setup-options-title">세계 규칙</h2>
        </div>
        <span className="status_pill">미리보기</span>
      </div>
      <label className="custom_polity_toggle">
        <input
          data-testid="custom-polity-toggle"
          type="checkbox"
          checked={customPolityEnabled}
          onChange={(event) => onCustomPolityEnabledChange(event.target.checked)}
        />
        <span>사용자 정의 국가 이름</span>
      </label>
      {customPolityEnabled ? (
        <label className="field">
          <span>국가 이름</span>
          <input
            data-testid="custom-polity-name"
            value={customPolityName}
            onChange={(event) => onCustomPolityNameChange(event.target.value)}
            placeholder="예: 한성 연방"
            maxLength={80}
          />
        </label>
      ) : null}
      <div className="setup_select_grid">
        <label className="field">
          <span>난이도</span>
          <select
            data-testid="difficulty-select"
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value as CampaignDifficulty)}
          >
            {Object.entries(difficultyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>플래너 모델</span>
          <select
            data-testid="model-select"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as PlannerProvider)}
          >
            {Object.entries(modelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="setup_summary" data-testid="setup-summary" aria-live="polite">
        {polityName} · {difficultyLabels[difficulty]} · {modelLabels[provider]}
      </p>
      <p className="setup_note">
        선택한 플래너가 다음 명령을 구조화합니다. Codex와 Claude는 로컬 인증이 필요합니다.
      </p>
    </section>
  );
};
