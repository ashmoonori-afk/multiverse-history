import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const PresetSchema = z
  .object({
    schema: z.literal("multiverse-history-preset/1"),
    scenarioId: z.string().regex(/^scn_[a-z0-9_]+$/),
    titleKo: z.string().trim().min(1).max(120),
    era: z.string().trim().min(1).max(80),
    genre: z.string().trim().min(1).max(80),
    year: z.number().safe().int(),
    licenseSpdx: z.string().trim().min(1).max(120),
    authors: z.array(z.string().trim().min(1).max(120)).min(1),
    sourceManifest: z.array(z.string().trim().min(1).max(500)).min(1),
    assetManifest: z.array(z.string().trim().min(1).max(500)).min(1),
    nations: z.string().max(5000),
    regions: z.string().max(5000),
    geography: z.string().max(5000),
    rules: z.string().max(5000),
    history: z.string().max(5000),
    brainstormPrompt: z.string().max(2000),
    polishPrompt: z.string().max(2000),
  })
  .strict();

type PresetDraft = z.infer<typeof PresetSchema>;

interface PresetEditorProps {
  readonly initialPreset: PresetDraft;
  readonly onClose: () => void;
}

const clonePreset = (preset: PresetDraft): PresetDraft => ({
  ...preset,
  scenarioId: `${preset.scenarioId}_clone`,
  titleKo: `${preset.titleKo} 복제본`,
});

const createBlankPreset = (): PresetDraft => ({
  schema: "multiverse-history-preset/1",
  scenarioId: "scn_local_blank",
  titleKo: "새 로컬 시나리오",
  era: "custom",
  genre: "original",
  year: 0,
  licenseSpdx: "CC0-1.0",
  authors: ["Multiverse History Player"],
  sourceManifest: ["Player-authored local scenario"],
  assetManifest: ["Player-authored local geometry"],
  nations: "",
  regions: "",
  geography: "",
  rules: "",
  history: "",
  brainstormPrompt: "",
  polishPrompt: "",
});

const downloadPreset = (preset: PresetDraft): void => {
  const blobUrl = URL.createObjectURL(
    new Blob([JSON.stringify(preset)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${preset.scenarioId}.json`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};

export const PresetEditor = ({ initialPreset, onClose }: PresetEditorProps): JSX.Element => {
  const [draft, setDraft] = useState(initialPreset);
  const [status, setStatus] = useState("실행 가능한 시나리오의 메타데이터를 편집합니다.");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const importPreset = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      setDraft(PresetSchema.parse(parsed));
      setStatus("프리셋을 가져옴");
    } catch {
      setStatus("프리셋 형식이 올바르지 않습니다.");
    }
  };

  return (
    <div className="imposter">
      <button
        className="modal_backdrop"
        type="button"
        aria-label="배경을 눌러 프리셋 편집기 닫기"
        onClick={onClose}
      />
      <div
        className="modal_shell preset_editor"
        data-testid="preset-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-editor-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="modal_header preset_editor_header">
          <div>
            <span className="eyebrow">로컬 프리셋</span>
            <h2 id="preset-editor-title">세계 프리셋 편집</h2>
          </div>
          <div className="cluster">
            <span className="status_pill">기기 전용</span>
            <button
              className="quiet_button"
              data-testid="close-preset-editor"
              type="button"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </header>
        <div className="modal_body preset_editor_body" data-testid="preset-scroll-body">
          <p className="preset_editor_intro">
            빈 시나리오를 만들고 검증된 JSON으로 내보내거나 기기 전용으로 게시할 수 있습니다.
          </p>
          <div className="preset_editor_fields">
            <label className="field preset_field_readonly">
              <span>프리셋 ID</span>
              <input data-testid="preset-id" value={draft.scenarioId} readOnly />
            </label>
            <label className="field">
              <span>표시 이름</span>
              <input
                data-testid="preset-title"
                value={draft.titleKo}
                maxLength={120}
                onChange={(event) => setDraft({ ...draft, titleKo: event.target.value })}
              />
            </label>
            <label className="field">
              <span>시작 연도</span>
              <input
                data-testid="preset-year"
                type="number"
                value={draft.year}
                onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
              />
            </label>
            {(
              [
                ["nations", "국가"],
                ["regions", "지역"],
                ["geography", "지리"],
                ["rules", "규칙"],
                ["history", "역사"],
                ["brainstormPrompt", "브레인스토밍 프롬프트"],
                ["polishPrompt", "다듬기 프롬프트"],
              ] as const
            ).map(([key, label]) => (
              <label className="field preset_field_long" key={key}>
                <span>{label}</span>
                <textarea
                  data-testid={`preset-${key}`}
                  value={draft[key]}
                  maxLength={key.endsWith("Prompt") ? 2000 : 5000}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </div>
        <footer className="modal_footer preset_editor_footer">
          <div className="cluster preset_editor_actions">
            <button
              className="secondary_button"
              data-testid="new-blank-preset"
              type="button"
              onClick={() => {
                setDraft(createBlankPreset());
                setStatus("빈 프리셋을 만듦");
              }}
            >
              빈 시나리오
            </button>
            <button
              className="secondary_button"
              data-testid="clone-preset"
              type="button"
              onClick={() => {
                setDraft(clonePreset(draft));
                setStatus("프리셋을 복제함");
              }}
            >
              복제
            </button>
            <button
              className="secondary_button"
              data-testid="export-preset"
              type="button"
              onClick={() => {
                downloadPreset(draft);
                setStatus("프리셋을 내보냄");
              }}
            >
              JSON 내보내기
            </button>
            <label className="file_button">
              JSON 가져오기
              <input
                data-testid="import-preset-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void importPreset(event)}
              />
            </label>
            <button
              className="secondary_button"
              data-testid="publish-preset"
              type="button"
              onClick={() => setStatus(`로컬 게시 완료: ${draft.titleKo}`)}
            >
              로컬 게시
            </button>
          </div>
          <p className="preset_status" data-testid="preset-status" role="status">
            {status}
          </p>
        </footer>
      </div>
    </div>
  );
};

export type { PresetDraft };
