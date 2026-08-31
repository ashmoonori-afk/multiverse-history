import { expect, test } from "@playwright/test";

import { openAdvisor, selectNationFromSearch, startKoreanCampaign } from "./helpers/open-historia";

test("selects Japan and exposes its regions and Korea relation in the advisor", async ({
  page,
}) => {
  await startKoreanCampaign(page);
  await selectNationFromSearch(page, "일본제국");
  await openAdvisor(page);

  await expect(page.getByTestId("selected-nation-panel")).toHaveAttribute(
    "data-nation-id",
    "nat_jpn",
  );
  await expect(page.getByTestId("selected-nation-owned")).not.toHaveText("0");
  await expect(page.getByTestId("selected-nation-relation")).toBeVisible();
  await expect(page.getByTestId("selected-nation-panel")).toContainText("일본제국");
});
