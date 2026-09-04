import { describe, expect, test } from "bun:test";

import {
  createCampaignExport,
  importCampaignExport,
  serializeCampaignExport,
} from "../../src/persistence/export-import";

const scenario = {
  id: "scn_ea1900",
  revision: 1,
  canonicalHash: "a".repeat(64),
};

const state = {
  stateVersion: 1,
  turn: 3,
  date: { year: 1900, quarter: 4 },
  playerNationId: "nat_kor",
  treasuryCredits: 375,
  treaties: [{ id: "try_kor_qing_alliance", status: "active" }],
  events: ["evt_rail", "evt_alliance"],
};

describe("campaign export and import", () => {
  test("round-trips the exact canonical state hash", () => {
    // Given
    const serialized = serializeCampaignExport({ scenario, state });

    // When
    const imported = importCampaignExport({ json: serialized, expectedScenario: scenario });
    const original = createCampaignExport({ scenario, state });

    // Then
    expect(imported.state).toEqual(state);
    expect(imported.exportedStateHash).toBe(original.exportedStateHash);
  });

  test("rejects corruption when the exported SHA-256 checksum no longer matches", () => {
    // Given
    const serialized = serializeCampaignExport({ scenario, state });
    const tampered = serialized.replace('"treasuryCredits":375', '"treasuryCredits":999');

    // When
    const importTampered = () =>
      importCampaignExport({ json: tampered, expectedScenario: scenario });

    // Then
    expect(importTampered).toThrow("STATE_HASH_MISMATCH");
  });

  test("rejects scenario hash mismatch and oversized input", () => {
    // Given
    const serialized = serializeCampaignExport({ scenario, state });
    const wrongScenario = { ...scenario, canonicalHash: "b".repeat(64) };
    const oversized = "x".repeat(10 * 1024 * 1024 + 1);

    // When
    const importWrongScenario = () =>
      importCampaignExport({ json: serialized, expectedScenario: wrongScenario });
    const importOversized = () =>
      importCampaignExport({ json: oversized, expectedScenario: scenario });

    // Then
    expect(importWrongScenario).toThrow("SCENARIO_HASH_MISMATCH");
    expect(importOversized).toThrow("IMPORT_TOO_LARGE");
  });
});
