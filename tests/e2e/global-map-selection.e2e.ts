import { expect, test } from "@playwright/test";

import { openAdvisor, selectNationFromSearch, startKoreanCampaign } from "./helpers/open-historia";

test("selects Russia through the Open Historia map search and opens its inspector", async ({
  page,
}) => {
  await startKoreanCampaign(page);
  await selectNationFromSearch(page, "러시아제국");
  await openAdvisor(page);

  await expect(page.getByTestId("selected-nation-panel")).toHaveAttribute(
    "data-nation-id",
    "nat_rus",
  );
  await expect(page.getByTestId("selected-nation-panel")).toContainText("러시아제국");
});
