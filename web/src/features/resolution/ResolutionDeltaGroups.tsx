import type { CampaignResolution, StrategicPlan } from "../../state/campaign-store";
import "./campaign-result.css";

interface ResolutionDeltaGroupsProps {
  readonly resolution: CampaignResolution;
  readonly playerNationId: string;
  readonly nationNameById: ReadonlyMap<string, string>;
}

interface DeltaRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

const integerFormatter = new Intl.NumberFormat("ko-KR");
const formatInteger = (value: number): string => integerFormatter.format(value);
const formatChange = (before: number, after: number): string =>
  `${formatInteger(before)} → ${formatInteger(after)}`;

const numericRows = (
  resolution: CampaignResolution,
  playerNationId: string,
  source: "policy" | "tick",
): readonly DeltaRow[] =>
  resolution.nationDeltas
    .filter((delta) => delta.nationId === playerNationId)
    .flatMap((delta, index) => {
      const fields = [
        [
          "treasuryCredits",
          source === "tick" ? "국고 (세입·통상·유지비 합산)" : "국고",
          delta.treasuryCredits,
        ],
        ["gdpCredits", "국내총생산", delta.gdpCredits],
        ["infrastructureBps", "기반시설", delta.infrastructureBps],
        ["stabilityBps", "안정도", delta.stabilityBps],
        ["population", "인구", delta.population],
        ["taxRateBps", "세율", delta.taxRateBps],
      ] as const;
      return fields.flatMap(([key, label, value]) =>
        value === undefined || value.source !== source || value.before === value.after
          ? []
          : [{ key: `${index}-${key}`, label, value: formatChange(value.before, value.after) }],
      );
    });

const relationRows = (
  resolution: CampaignResolution,
  playerNationId: string,
  nationNameById: ReadonlyMap<string, string>,
  source: "policy" | "tick",
): readonly DeltaRow[] =>
  resolution.relationDeltas
    .filter(
      (delta) =>
        delta.source === source &&
        (delta.fromNationId === playerNationId || delta.toNationId === playerNationId),
    )
    .map((delta, index) => {
      const counterpartNationId =
        delta.fromNationId === playerNationId ? delta.toNationId : delta.fromNationId;
      return {
        key: `relation-${index}`,
        label: `외교 관계 · ${nationNameById.get(counterpartNationId) ?? counterpartNationId}`,
        value: formatChange(delta.before, delta.after),
      };
    });

const treatyRows = (
  resolution: CampaignResolution,
  playerNationId: string,
  nationNameById: ReadonlyMap<string, string>,
  source: "policy" | "tick",
): readonly DeltaRow[] =>
  resolution.treatyDeltas
    .filter(
      (delta) =>
        delta.source === source &&
        [delta.proposerNationId, delta.recipientNationId].includes(playerNationId),
    )
    .map((delta) => {
      const counterpartNationId =
        delta.proposerNationId === playerNationId
          ? delta.recipientNationId
          : delta.proposerNationId;
      return {
        key: delta.id,
        label: delta.clauses.includes("trade") ? "통상 협정" : "협정",
        value: `${nationNameById.get(counterpartNationId) ?? counterpartNationId} · ${delta.status}`,
      };
    });

const unitRow = (
  delta: CampaignResolution["unitDeltas"][number],
  source: "policy" | "tick",
): DeltaRow | undefined => {
  if (delta.before === null) {
    if (delta.after === null) return undefined;
    return {
      key: delta.unitId,
      label: "부대 창설",
      value: `${delta.unitId} · ${formatInteger(delta.after.manpower)}명`,
    };
  }
  if (delta.after === null) {
    return {
      key: delta.unitId,
      label: source === "tick" ? "유지비 부족·부대 해산" : "부대 해산",
      value: `${delta.unitId} · ${formatInteger(delta.before.manpower)}명 → 해산`,
    };
  }
  if (delta.before.manpower !== delta.after.manpower) {
    const supplyLoss = source === "tick" && delta.after.manpower < delta.before.manpower;
    return {
      key: `${delta.unitId}-manpower`,
      label: supplyLoss ? "보급 손실" : "병력",
      value: `${delta.unitId} · ${formatChange(delta.before.manpower, delta.after.manpower)}명`,
    };
  }
  if (delta.before.provinceId === delta.after.provinceId) return undefined;
  return {
    key: `${delta.unitId}-move`,
    label: "부대 이동",
    value: `${delta.before.provinceId} → ${delta.after.provinceId}`,
  };
};

const unitRows = (
  resolution: CampaignResolution,
  playerNationId: string,
  source: "policy" | "tick",
): readonly DeltaRow[] =>
  resolution.unitDeltas
    .filter((delta) => delta.source === source && delta.ownerNationId === playerNationId)
    .map((delta) => unitRow(delta, source))
    .filter((row): row is DeltaRow => row !== undefined);

const rowsFor = (
  resolution: CampaignResolution,
  playerNationId: string,
  nationNameById: ReadonlyMap<string, string>,
  source: "policy" | "tick",
): readonly DeltaRow[] => [
  ...numericRows(resolution, playerNationId, source),
  ...relationRows(resolution, playerNationId, nationNameById, source),
  ...treatyRows(resolution, playerNationId, nationNameById, source),
  ...unitRows(resolution, playerNationId, source),
];

const DeltaGroup = ({
  resolution,
  playerNationId,
  nationNameById,
  source,
}: ResolutionDeltaGroupsProps & { readonly source: "policy" | "tick" }): JSX.Element => {
  const rows = rowsFor(resolution, playerNationId, nationNameById, source);
  const heading = source === "policy" ? "정책 결과" : "시간 경과";
  const testId = source === "policy" ? "resolution-policy-deltas" : "resolution-tick-deltas";
  return (
    <section className="resolution_delta_group" data-testid={testId}>
      <h3>{heading}</h3>
      {rows.length === 0 ? (
        <p>기록된 변화 없음</p>
      ) : (
        <ul className="resolution_delta_rows">
          {rows.map((row) => (
            <li key={row.key}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const ResolutionDeltaGroups = (props: ResolutionDeltaGroupsProps): JSX.Element => (
  <div className="resolution_delta_groups" data-testid="resolution-before-after">
    <DeltaGroup {...props} source="policy" />
    <DeltaGroup {...props} source="tick" />
  </div>
);

export const ResolutionFailures = ({
  plan,
}: {
  readonly plan: StrategicPlan | null;
}): JSX.Element | null => {
  const failures =
    plan?.playerIntents.flatMap((intent) =>
      intent.type === "action.fail" ? [intent.attemptKo] : [],
    ) ?? [];
  return failures.length === 0 ? null : (
    <section className="resolution_failures" aria-labelledby="resolution-failures-title">
      <h3 id="resolution-failures-title">실패한 시도</h3>
      <ul>
        {failures.map((failure) => (
          <li key={failure}>{failure}</li>
        ))}
      </ul>
    </section>
  );
};
