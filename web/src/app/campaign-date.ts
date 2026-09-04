export const formatCampaignYear = (year: number): string =>
  year < 0 ? `기원전 ${Math.abs(year)}년` : `${year}년`;
