import { useEffect, useState } from "react";

import { SearchableSelect } from "../features/controls/SearchableSelect";
import { GameLibrary } from "../features/library/GameLibrary";
import { PresetEditor } from "../features/presets/PresetEditor";
import { CampaignSetupOptions } from "../features/setup/CampaignSetupOptions";
import type {
  CampaignCreationOptions,
  CampaignDifficulty,
  PlannerProvider,
} from "../state/campaign-store";
import {
  CatalogSchema,
  defaultNationOptions,
  defaultPreset,
  defaultScenarioOptions,
} from "./campaign-setup-catalog";

interface StartScreenProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onStart: (
    scenarioId: string,
    nationId: string,
    provider: PlannerProvider,
    options?: CampaignCreationOptions,
  ) => Promise<boolean>;
  readonly onImport: (json: string) => Promise<boolean>;
}

export const StartScreen = ({ busy, error, onStart, onImport }: StartScreenProps): JSX.Element => {
  const [scenarioOptions, setScenarioOptions] = useState(defaultScenarioOptions);
  const [nationOptions, setNationOptions] = useState(defaultNationOptions);
  const [scenarioId, setScenarioId] = useState(defaultScenarioOptions[0]?.id ?? "");
  const [nationId, setNationId] = useState(defaultNationOptions[0]?.id ?? "");
  const [provider, setProvider] = useState<PlannerProvider>("codex");
  const [customPolityEnabled, setCustomPolityEnabled] = useState(false);
  const [customPolityName, setCustomPolityName] = useState("");
  const [difficulty, setDifficulty] = useState<CampaignDifficulty>("standard");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    const loadCatalog = async (): Promise<void> => {
      try {
        const response = await fetch("/api/catalog");
        if (!response.ok) return;
        const catalog = CatalogSchema.parse(await response.json());
        const loadedScenarios = catalog.scenarios.map((scenario) => ({
          ...scenario,
          nations: scenario.nations.map((nation) => ({ id: nation.id, titleKo: nation.nameKo })),
          description:
            scenario.id === "scn_ea1900"
              ? "대한제국과 주변 강대국의 산업화와 외교를 지휘합니다."
              : `${scenario.year}년 · 모든 국가에서 시작할 수 있는 중립 시나리오`,
        }));
        const loadedNations = catalog.countries.map((country) => ({
          id: country.id,
          titleKo: country.nameKo,
        }));
        setScenarioOptions(loadedScenarios);
        setNationOptions(loadedNations);
        setScenarioId((current) =>
          loadedScenarios.some((scenario) => scenario.id === current)
            ? current
            : (loadedScenarios[0]?.id ?? current),
        );
        setNationId((current) =>
          loadedNations.some((nation) => nation.id === current)
            ? current
            : (loadedNations[0]?.id ?? current),
        );
      } catch {
        // Keep the compact built-in fallback when the catalog request is unavailable.
      } finally {
        setCatalogLoading(false);
      }
    };
    void loadCatalog();
  }, []);

  const scenario = scenarioOptions.find((option) => option.id === scenarioId);
  const availableNations =
    scenario?.nations ??
    nationOptions.filter((nation) => scenario?.playerNationIds.includes(nation.id) ?? true);
  const nation = availableNations.find((option) => option.id === nationId);
  const nationSearchOptions = availableNations.map((option) => ({
    id: option.id,
    label: option.titleKo,
  }));

  useEffect(() => {
    if (availableNations.some((option) => option.id === nationId)) return;
    const firstNation = availableNations[0];
    if (firstNation !== undefined) setNationId(firstNation.id);
  }, [availableNations, nationId]);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await onStart(scenarioId, nationId, provider, {
      ...(customPolityEnabled && customPolityName.trim()
        ? { customPolityName: customPolityName.trim() }
        : {}),
      difficulty,
    });
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) return;
    await onImport(await file.text());
  };

  return (
    <main className="start_screen">
      <div className="content-limiter">
        <form className="panel-layout" onSubmit={submit}>
          <section className="start_hero" aria-labelledby="start-title">
            <div className="start_hero_heading">
              <span className="eyebrow">한국어 전략 시뮬레이션</span>
              <h1 id="start-title">Multiverse History</h1>
              <span
                className="load_indicator"
                data-testid="catalog-status"
                data-loading={catalogLoading}
                aria-live="polite"
              >
                {catalogLoading ? "목록 동기화 중" : `${scenarioOptions.length}개 시나리오`}
              </span>
            </div>
            <p className="start_intro">
              하나의 명령이 경제, 외교, 군사와 기록을 함께 움직입니다. 검증 가능한 상태를 바탕으로
              나만의 역사를 시작하세요.
            </p>
            <div className="start_context">
              <div className="scenario_detail" data-testid="scenario-summary">
                <span className="eyebrow">선택한 세계</span>
                <strong>{scenario?.titleKo ?? "시나리오를 선택하세요"}</strong>
                <span>{scenario?.description ?? ""}</span>
              </div>
              <div className="scenario_detail" data-testid="nation-summary">
                <span className="eyebrow">지휘 국가</span>
                <strong>{nation?.titleKo ?? "국가를 선택하세요"}</strong>
                <span>수도, 영토, 자원과 외교 관계를 직접 지휘합니다.</span>
              </div>
            </div>
          </section>

          <section className="start_setup" aria-labelledby="start-setup-title">
            <div className="start_setup_heading">
              <div>
                <span className="eyebrow">새 캠페인</span>
                <h2 id="start-setup-title">세계와 지휘국 설정</h2>
              </div>
              <span className="status_pill">로컬 시작</span>
            </div>
            <div className="picker_grid">
              <div className="field">
                <label htmlFor="scenario-select">시나리오</label>
                <select
                  id="scenario-select"
                  data-testid="scenario-select"
                  value={scenarioId}
                  onChange={(event) => setScenarioId(event.target.value)}
                >
                  {scenarioOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.titleKo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="nation-search-input">플레이 국가</label>
                <SearchableSelect
                  label="플레이 국가 검색"
                  inputId="nation-search-input"
                  testId="nation-select"
                  optionTestIdPrefix="nation-search-option"
                  placeholder="국가 이름 또는 코드 검색"
                  options={nationSearchOptions}
                  value={nationId}
                  onSelect={setNationId}
                />
              </div>
            </div>
            <CampaignSetupOptions
              provider={provider}
              onProviderChange={setProvider}
              customPolityEnabled={customPolityEnabled}
              customPolityName={customPolityName}
              onCustomPolityEnabledChange={setCustomPolityEnabled}
              onCustomPolityNameChange={setCustomPolityName}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
            />
            {error !== null ? (
              <div className="error_banner" role="alert">
                {error}
              </div>
            ) : null}
            <button
              className="primary_button"
              data-testid="start-campaign"
              type="submit"
              disabled={busy || catalogLoading}
            >
              {busy ? "세계 준비 중…" : "캠페인 시작"}
            </button>
            <menu className="cluster start_secondary_actions" aria-label="보조 시작 작업">
              <button
                className="secondary_button"
                data-testid="open-game-library"
                type="button"
                onClick={() => setLibraryOpen(true)}
              >
                게임 라이브러리
              </button>
              <button
                className="secondary_button"
                data-testid="open-preset-editor"
                type="button"
                onClick={() => setPresetEditorOpen(true)}
              >
                세계 프리셋 편집
              </button>
              <label className="file_button">
                저장 파일 가져오기
                <input
                  data-testid="import-campaign-input"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void importFile(event)}
                />
              </label>
            </menu>
          </section>
        </form>
      </div>
      {libraryOpen ? <GameLibrary onClose={() => setLibraryOpen(false)} /> : null}
      {presetEditorOpen ? (
        <PresetEditor initialPreset={defaultPreset} onClose={() => setPresetEditorOpen(false)} />
      ) : null}
    </main>
  );
};
