import { expect, test } from "bun:test";

import { formatCampaignYear } from "../../web/src/app/campaign-date";

test("formats BCE campaign years without a negative sign", () => {
  expect(formatCampaignYear(-1200)).toBe("기원전 1200년");
  expect(formatCampaignYear(117)).toBe("117년");
  expect(formatCampaignYear(2281)).toBe("2281년");
});
