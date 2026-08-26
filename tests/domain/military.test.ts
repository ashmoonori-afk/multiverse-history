import { describe, expect, test } from "bun:test";

import type { ProvinceNode, UnitState } from "../../src/domain/military/combat";
import {
  assertAdjacentMove,
  calculateSupplyBps,
  resolveCombat,
} from "../../src/domain/military/combat";
import { parseNationId } from "../../src/shared/ids";

const korea = parseNationId("nat_kor");
const russia = parseNationId("nat_rus");

const provinces: readonly ProvinceNode[] = [
  {
    id: "prv_kor_hanseong",
    controllerNationId: korea,
    isCapital: true,
    isPort: false,
    adjacentProvinceIds: ["prv_kor_hamgyeong"],
  },
  {
    id: "prv_kor_hamgyeong",
    controllerNationId: korea,
    isCapital: false,
    isPort: false,
    adjacentProvinceIds: ["prv_kor_hanseong", "prv_rus_primorye"],
  },
  {
    id: "prv_rus_primorye",
    controllerNationId: russia,
    isCapital: false,
    isPort: true,
    adjacentProvinceIds: ["prv_kor_hamgyeong"],
  },
];

const attacker: UnitState = {
  id: "unt_kor_0001",
  ownerNationId: korea,
  currentProvinceId: "prv_kor_hamgyeong",
  manpower: 10_000,
  equipmentBps: 9_000,
  readinessBps: 9_000,
  supplyBps: 8_500,
  status: "active",
};

const defender: UnitState = {
  id: "unt_rus_0001",
  ownerNationId: russia,
  currentProvinceId: "prv_rus_primorye",
  manpower: 4_000,
  equipmentBps: 8_000,
  readinessBps: 8_000,
  supplyBps: 8_000,
  status: "active",
};

describe("military supply, movement, and combat", () => {
  test("calculates supply from the shortest sorted friendly path", () => {
    // Given
    const input = {
      ownerNationId: korea,
      unitProvinceId: "prv_kor_hamgyeong",
      provinces,
      militaryAccessNationIds: [],
    };

    // When
    const supplyBps = calculateSupplyBps(input);

    // Then
    expect(supplyBps).toBe(9_250);
  });

  test("returns unsupplied value when no legal path reaches a capital or port", () => {
    // Given
    const input = {
      ownerNationId: korea,
      unitProvinceId: "prv_rus_primorye",
      provinces,
      militaryAccessNationIds: [],
    };

    // When
    const supplyBps = calculateSupplyBps(input);

    // Then
    expect(supplyBps).toBe(2_500);
  });

  test("permits adjacent movement and rejects non-adjacent movement", () => {
    // Given
    const legalDestination = "prv_kor_hanseong";
    const illegalDestination = "prv_missing";

    // When
    assertAdjacentMove(attacker.currentProvinceId, legalDestination, provinces);
    const moveTooFar = () =>
      assertAdjacentMove(attacker.currentProvinceId, illegalDestination, provinces);

    // Then
    expect(moveTooFar).toThrow("DESTINATION_NOT_ADJACENT");
  });

  test("resolves seeded combat identically with casualties and attacker victory", () => {
    // Given
    const input = {
      campaignSeed: "campaign-seed-1900",
      turn: 3,
      attacker,
      defenders: [defender],
      terrain: "urban" as const,
    };

    // When
    const first = resolveCombat(input);
    const second = resolveCombat(input);

    // Then
    expect(second).toEqual(first);
    expect(first.attackerWon).toBe(true);
    expect(first.attackerCasualties).toBeGreaterThan(0);
    expect(first.defenderCasualties).toBeGreaterThan(first.attackerCasualties);
    expect(first.attackerRemaining).toBe(attacker.manpower - first.attackerCasualties);
    expect(first.defenderRemaining).toBe(defender.manpower - first.defenderCasualties);
  });
});
