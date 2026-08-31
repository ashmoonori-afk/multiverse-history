import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const selectStartNation = async (page: Page, nationId: string): Promise<void> => {
  const search = page.getByRole("combobox", { name: "플레이 국가 검색" });
  await search.fill(nationId);
  await page.getByTestId(`nation-search-option-${nationId}`).click();
  await expect(page.getByTestId("nation-select")).toHaveAttribute("data-selected-id", nationId);
};

export const openStartScreen = async (page: Page): Promise<void> => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .locator('[data-testid="scenario-select"], [data-testid="campaign-state"]')
    .first()
    .waitFor({ state: "visible" });
  if (await page.getByTestId("campaign-state").isVisible()) {
    const directExit = page.getByTestId("new-campaign");
    if ((await directExit.count()) > 0 && (await directExit.isVisible())) {
      await directExit.click({ force: true });
    } else {
      await page.getByTestId("oh-settings").click();
      await page.getByRole("button", { name: "새 캠페인", exact: true }).click();
    }
  }
  await expect(page.getByTestId("catalog-status")).toHaveAttribute("data-loading", "false");
};

export const startKoreanCampaign = async (page: Page): Promise<void> => {
  await openStartScreen(page);
  await page.getByTestId("scenario-select").selectOption("scn_ea1900");
  await selectStartNation(page, "nat_kor");
  await page.getByTestId("model-select").selectOption("deterministic");
  await page.getByTestId("start-campaign").click();
  await expect(page.getByTestId("campaign-state")).toBeVisible();
  await expect(page.getByTestId("open-historia-world")).toHaveAttribute(
    "data-map-data-state",
    "ready",
  );
};

export const openHudPanel = async (
  page: Page,
  controlTestId: string,
  panelName: string,
): Promise<void> => {
  const control = page.getByTestId(controlTestId);
  const hud = page.getByTestId("open-historia-hud");
  if ((await hud.getAttribute("data-open-panel")) === "advisor") {
    const closeAdvisor = page.getByTestId("close-advisor");
    await closeAdvisor.click();
  }
  if ((await control.getAttribute("aria-expanded")) !== "true") {
    await control.click();
  }
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: panelName, exact: true })).toBeVisible();
};

export const openAdvisor = async (page: Page): Promise<void> => {
  const control = page.getByTestId("oh-advisor");
  if ((await control.getAttribute("aria-expanded")) !== "true") {
    await control.click();
  }
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("complementary", { name: "전략 자문" })).toBeVisible();
};

export const selectNationFromSearch = async (page: Page, nationName: string): Promise<void> => {
  await openHudPanel(page, "oh-search", "국가 검색");
  const search = page.getByRole("combobox", { name: "국가 검색" });
  await search.fill(nationName);
  await page
    .getByRole("listbox", { name: "국가 검색 결과" })
    .getByRole("option", { name: nationName, exact: true })
    .click();
  await expect(search).toHaveValue(nationName);
};
