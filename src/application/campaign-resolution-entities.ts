import type { CampaignState } from "./campaign-state";

export type CampaignDeltaSource = "policy" | "tick";

export interface CampaignUnitSnapshot {
  readonly ownerNationId: string;
  readonly provinceId: string;
  readonly manpower: number;
}

export interface CampaignUnitDelta {
  readonly unitId: string;
  readonly ownerNationId: string;
  readonly before: CampaignUnitSnapshot | null;
  readonly after: CampaignUnitSnapshot | null;
  readonly source: CampaignDeltaSource;
}

const snapshot = (unit: CampaignState["units"][number] | undefined): CampaignUnitSnapshot | null =>
  unit === undefined
    ? null
    : Object.freeze({
        ownerNationId: unit.ownerNationId,
        provinceId: unit.provinceId,
        manpower: unit.manpower,
      });

export const campaignUnitDelta = (
  before: CampaignState["units"][number] | undefined,
  after: CampaignState["units"][number] | undefined,
  source: CampaignDeltaSource,
): CampaignUnitDelta => {
  const ownerNationId = after?.ownerNationId ?? before?.ownerNationId;
  if (ownerNationId === undefined) throw new RangeError("UNIT_DELTA_EMPTY");
  return Object.freeze({
    unitId: after?.id ?? before?.id ?? "",
    ownerNationId,
    before: snapshot(before),
    after: snapshot(after),
    source,
  });
};

export const campaignUnitDeltas = (
  before: CampaignState,
  after: CampaignState,
  source: CampaignDeltaSource,
): readonly CampaignUnitDelta[] =>
  Object.freeze(
    [...new Set([...before.units.map((unit) => unit.id), ...after.units.map((unit) => unit.id)])]
      .flatMap((unitId) => {
        const beforeUnit = before.units.find((unit) => unit.id === unitId);
        const afterUnit = after.units.find((unit) => unit.id === unitId);
        if (
          beforeUnit?.ownerNationId === afterUnit?.ownerNationId &&
          beforeUnit?.provinceId === afterUnit?.provinceId &&
          beforeUnit?.manpower === afterUnit?.manpower
        ) {
          return [];
        }
        return [campaignUnitDelta(beforeUnit, afterUnit, source)];
      })
      .filter((delta) => delta.unitId.length > 0),
  );

export const changedEntityOwnerIds = (
  before: CampaignState,
  after: CampaignState,
): readonly string[] => [
  ...campaignUnitDeltas(before, after, "policy").map((delta) => delta.ownerNationId),
  ...after.constructionProjects.flatMap((project) =>
    before.constructionProjects.some((candidate) => candidate.id === project.id)
      ? []
      : [project.ownerNationId],
  ),
];
