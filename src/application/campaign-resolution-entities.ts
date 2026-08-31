import type { CampaignState } from "./campaign-state";

export const changedEntityOwnerIds = (
  before: CampaignState,
  after: CampaignState,
): readonly string[] => [
  ...after.units.flatMap((unit) => {
    const beforeUnit = before.units.find((candidate) => candidate.id === unit.id);
    return beforeUnit === undefined ||
      beforeUnit.provinceId !== unit.provinceId ||
      beforeUnit.manpower !== unit.manpower
      ? [unit.ownerNationId]
      : [];
  }),
  ...after.constructionProjects.flatMap((project) =>
    before.constructionProjects.some((candidate) => candidate.id === project.id)
      ? []
      : [project.ownerNationId],
  ),
];
