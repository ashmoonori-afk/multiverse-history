import { describe, expect, test } from "bun:test";

import {
  calculateTradeIncome,
  resolveQuarterEconomy,
} from "../../src/domain/economy/resolve-quarter";

describe("quarterly economy and population simulation", () => {
  test("resolves the Korean rail investment with exact integer outcomes", () => {
    // Given
    const korea = {
      treasuryCredits: 240,
      gdpCredits: 1_200,
      taxRateBps: 1_500,
      unitUpkeepCredits: 20,
      tradeIncomeCredits: 0,
      railInvestmentCredits: 25,
      infrastructureBps: 2_400,
      population: 17_082_000,
      annualGrowthBps: 800,
    };

    // When
    const result = resolveQuarterEconomy(korea);

    // Then
    expect(result).toEqual({
      treasuryCredits: 375,
      gdpCredits: 1_202,
      infrastructureBps: 2_650,
      population: 17_423_640,
      taxRevenueCredits: 180,
      populationGrowth: 341_640,
    });
  });

  test("calculates recurring bilateral trade from the smaller economy", () => {
    // Given
    const koreanGdp = 1_200;
    const japaneseGdp = 3_900;
    const clauseStrengthBps = 2_500;

    // When
    const income = calculateTradeIncome(koreanGdp, japaneseGdp, clauseStrengthBps);

    // Then
    expect(income).toBe(30);
  });

  test("caps rail infrastructure gain and keeps persisted values integral", () => {
    // Given
    const highInvestment = {
      treasuryCredits: 2_000,
      gdpCredits: 5_000,
      taxRateBps: 1_000,
      unitUpkeepCredits: 0,
      tradeIncomeCredits: 0,
      railInvestmentCredits: 100,
      infrastructureBps: 9_800,
      population: 1_000_001,
      annualGrowthBps: 333,
    };

    // When
    const result = resolveQuarterEconomy(highInvestment);

    // Then
    expect(result.infrastructureBps).toBe(10_000);
    expect(Object.values(result).every(Number.isSafeInteger)).toBe(true);
  });

  test("rejects negative, floating, and out-of-range boundary values", () => {
    // Given
    const invalidInputs = [
      {
        treasuryCredits: -1,
        gdpCredits: 1_000,
        taxRateBps: 1_000,
        unitUpkeepCredits: 0,
        tradeIncomeCredits: 0,
        railInvestmentCredits: 25,
        infrastructureBps: 2_000,
        population: 1_000_000,
        annualGrowthBps: 500,
      },
      {
        treasuryCredits: 100,
        gdpCredits: 1_000.5,
        taxRateBps: 1_000,
        unitUpkeepCredits: 0,
        tradeIncomeCredits: 0,
        railInvestmentCredits: 25,
        infrastructureBps: 2_000,
        population: 1_000_000,
        annualGrowthBps: 500,
      },
      {
        treasuryCredits: 100,
        gdpCredits: 1_000,
        taxRateBps: 10_001,
        unitUpkeepCredits: 0,
        tradeIncomeCredits: 0,
        railInvestmentCredits: 25,
        infrastructureBps: 2_000,
        population: 1_000_000,
        annualGrowthBps: 500,
      },
    ];

    // When
    const resolveInvalid = () => invalidInputs.map(resolveQuarterEconomy);

    // Then
    expect(resolveInvalid).toThrow();
  });
});
