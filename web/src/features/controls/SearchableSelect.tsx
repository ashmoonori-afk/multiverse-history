import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
}

interface SearchableSelectProps {
  readonly label: string;
  readonly options: readonly SearchableSelectOption[];
  readonly value: string;
  readonly onSelect: (optionId: string) => void;
  readonly optionTestIdPrefix: string;
  readonly testId?: string;
  readonly inputId?: string;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
}

const MAX_VISIBLE_RESULTS = 8;

const matchesQuery = (option: SearchableSelectOption, query: string): boolean =>
  option.label.toLowerCase().includes(query) || option.id.toLowerCase().includes(query);

const wrapIndex = (index: number, length: number): number => {
  if (length === 0) return 0;
  if (index < 0) return length - 1;
  if (index >= length) return 0;
  return index;
};

export const SearchableSelect = ({
  label,
  options,
  value,
  onSelect,
  optionTestIdPrefix,
  testId,
  inputId,
  placeholder,
  emptyLabel = "검색 결과가 없습니다",
}: SearchableSelectProps): JSX.Element => {
  const listboxId = `${useId()}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedLabel = useMemo(
    () => options.find((option) => option.id === value)?.label ?? "",
    [options, value],
  );

  const results = useMemo(() => {
    const query = (draftQuery ?? "").trim().toLowerCase();
    const matched =
      query === "" ? options : options.filter((option) => matchesQuery(option, query));
    return matched.slice(0, MAX_VISIBLE_RESULTS);
  }, [options, draftQuery]);

  const resolvedIndex = wrapIndex(activeIndex, results.length);
  const activeOption = results[resolvedIndex];

  const collapse = (): void => {
    setExpanded(false);
    setDraftQuery(null);
    setActiveIndex(0);
  };

  useEffect(() => {
    if (!expanded) return undefined;
    const closeOnOutsidePress = (event: MouseEvent): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target) === true) return;
      setExpanded(false);
      setDraftQuery(null);
      setActiveIndex(0);
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    return () => document.removeEventListener("mousedown", closeOnOutsidePress);
  }, [expanded]);

  const commit = (option: SearchableSelectOption | undefined): void => {
    if (option === undefined) return;
    onSelect(option.id);
    collapse();
  };

  const moveActive = (delta: number): void => {
    setExpanded(true);
    setActiveIndex(wrapIndex(resolvedIndex + delta, results.length));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        return;
      case "Enter":
        if (!expanded) return;
        event.preventDefault();
        commit(activeOption);
        return;
      case "Escape":
        collapse();
        return;
      default:
    }
  };

  return (
    <div
      className="searchable_select"
      ref={rootRef}
      data-testid={testId}
      data-selected-id={value}
      data-option-count={options.length}
      data-expanded={expanded}
    >
      <input
        className="searchable_select_input"
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && activeOption !== undefined ? `${listboxId}-${activeOption.id}` : undefined
        }
        placeholder={placeholder}
        value={draftQuery ?? selectedLabel}
        onChange={(event) => {
          setDraftQuery(event.target.value);
          setActiveIndex(0);
          setExpanded(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setExpanded(true)}
      />
      {expanded ? (
        <div
          className="searchable_select_results"
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={`${label} 결과`}
        >
          {results.map((option, index) => (
            <button
              type="button"
              key={option.id}
              id={`${listboxId}-${option.id}`}
              className="searchable_select_option"
              role="option"
              aria-selected={option.id === value}
              data-active={index === resolvedIndex}
              data-testid={`${optionTestIdPrefix}-${option.id}`}
              onClick={() => commit(option)}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <span className="searchable_select_option_label">{option.label}</span>
              {option.hint === undefined ? null : (
                <span className="searchable_select_option_hint">{option.hint}</span>
              )}
            </button>
          ))}
          {results.length === 0 ? <p className="searchable_select_empty">{emptyLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
};
