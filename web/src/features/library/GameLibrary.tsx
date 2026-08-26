import { useEffect, useState } from "react";
import { z } from "zod";

interface LibraryEntry {
  readonly id: string;
  readonly name: string;
}

const LibraryEntriesSchema = z.array(
  z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(80) }).strict(),
);

const initialEntries: readonly LibraryEntry[] = [{ id: "local-demo", name: "로컬 캠페인" }];

const readEntries = (): readonly LibraryEntry[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("multiverse-history-library") ?? "null",
    );
    const entries = LibraryEntriesSchema.safeParse(parsed);
    return entries.success && entries.data.length > 0 ? entries.data : initialEntries;
  } catch {
    return initialEntries;
  }
};

export const GameLibrary = (): JSX.Element => {
  const [entries, setEntries] = useState<readonly LibraryEntry[]>(initialEntries);
  const [selectedId, setSelectedId] = useState("local-demo");
  const [rename, setRename] = useState("");
  const [theme, setTheme] = useState<"paper" | "night">("paper");
  const [captions, setCaptions] = useState(true);
  const selected = entries.find((entry) => entry.id === selectedId);

  useEffect(() => {
    const storedEntries = readEntries();
    setEntries(storedEntries);
    const storedTheme = localStorage.getItem("multiverse-history-theme");
    if (storedTheme === "night" || storedTheme === "paper") {
      setTheme(storedTheme);
    }
    setCaptions(localStorage.getItem("multiverse-history-captions") !== "false");
  }, []);

  const persistEntries = (next: readonly LibraryEntry[]): void => {
    setEntries(next);
    localStorage.setItem("multiverse-history-library", JSON.stringify(next));
  };

  return (
    <section className="library_panel" data-testid="game-library">
      <div className="library_panel_heading">
        <div>
          <span className="eyebrow">로컬 보관함</span>
          <h2>게임 라이브러리</h2>
        </div>
        <span className="status_pill">기기 전용</span>
      </div>
      <label className="field">
        <span>게임 선택</span>
        <select
          data-testid="library-select"
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setRename("");
          }}
        >
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <div className="library_actions">
        <input
          data-testid="library-rename-input"
          value={rename}
          onChange={(event) => setRename(event.target.value)}
          placeholder={selected?.name ?? "새 이름"}
          maxLength={80}
        />
        <button
          className="quiet_button"
          data-testid="library-rename"
          type="button"
          onClick={() => {
            const name = rename.trim();
            if (selected === undefined || name.length === 0) {
              return;
            }
            persistEntries(
              entries.map((entry) => (entry.id === selected.id ? { ...entry, name } : entry)),
            );
            setRename("");
          }}
        >
          이름 변경
        </button>
        <button
          className="quiet_button"
          data-testid="library-duplicate"
          type="button"
          onClick={() => {
            if (selected === undefined) {
              return;
            }
            const copy = { id: `${selected.id}-${Date.now()}`, name: `${selected.name} 복제본` };
            persistEntries([...entries, copy]);
            setSelectedId(copy.id);
          }}
        >
          복제
        </button>
        <button
          className="quiet_button"
          data-testid="library-delete"
          type="button"
          disabled={entries.length <= 1}
          onClick={() => {
            if (selected === undefined || entries.length <= 1) {
              return;
            }
            const next = entries.filter((entry) => entry.id !== selected.id);
            persistEntries(next);
            setSelectedId(next[0]?.id ?? "local-demo");
          }}
        >
          삭제
        </button>
      </div>
      <div className="library_settings" data-testid="local-settings">
        <h3>로컬 설정</h3>
        <label className="field">
          <span>테마</span>
          <select
            data-testid="theme-select"
            value={theme}
            onChange={(event) => {
              const next = event.target.value as "paper" | "night";
              setTheme(next);
              localStorage.setItem("multiverse-history-theme", next);
            }}
          >
            <option value="paper">종이 지도</option>
            <option value="night">야간 지도</option>
          </select>
        </label>
        <label className="custom_polity_toggle">
          <input
            data-testid="captions-toggle"
            type="checkbox"
            checked={captions}
            onChange={(event) => {
              setCaptions(event.target.checked);
              localStorage.setItem("multiverse-history-captions", String(event.target.checked));
            }}
          />
          <span>자막과 보조 설명 표시</span>
        </label>
      </div>
    </section>
  );
};
