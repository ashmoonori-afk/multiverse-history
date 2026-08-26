import { z } from "zod";

export interface QuarterEconomyInput {
  readonly treasuryCredits: number;
  readonly gdpCredits: number;
  readonly taxRateBps: number;
  readonly unitUpkeepCredits: number;
  readonly tradeIncomeCredits: number;
  readonly railInvestmentCredits: number;
  readonly infrastructureBps: number;
  readonly population: number;
  readonly annualGrowthBps: number;
}

export interface QuarterEconomyResult {
  readonly treasuryCredits: number;
  readonly gdpCredits: number;
  readonly infrastructureBps: number;
  readonly population: number;
  readonly taxRevenueCredits: number;
  readonly populationGrowth: number;
}

const NonNegativeIntegerSchema = z.number().safe().int().min(0);
const BasisPointsSchema = NonNegativeIntegerSchema.max(10_000);
const RailInvestmentSchema = NonNegativeIntegerSchema.max(100).refine(
  (value) => value === 0 || value >= 20,
  "Rail investment must be zero or at least 20 credits",
);

const QuarterEconomyInputSchema = z
  .object({
    treasuryCredits: NonNegativeIntegerSchema,
    gdpCredits: NonNegativeIntegerSchema,
    taxRateBps: BasisPointsSchema,
    unitUpkeepCredits: NonNegativeIntegerSchema,
    tradeIncomeCredits: NonNegativeIntegerSchema,
    railInvestmentCredits: RailInvestmentSchema,
    infrastructureBps: BasisPointsSchema,
    population: NonNegativeIntegerSchema,
    annualGrowthBps: BasisPointsSchema,
  })
  .strict();

const assertSafeResults = (values: readonly number[]): void => {
  if (!values.every(Number.isSafeInteger)) {
    throw new RangeError("Economy result exceeds safe integer range");
  }
};
export const calculateTradeIncome = (
  gdpA: number,
  gdpB: number,
  clauseStrengthBps: number,
): number => {
  const [parsedGdpA, parsedGdpB] = z
    .tuple([NonNegativeIntegerSchema, NonNegativeIntegerSchema])
    .parse([gdpA, gdpB]);
  const parsedStrength = BasisPointsSchema.parse(clauseStrengthBps);
  const income = Math.floor((Math.min(parsedGdpA, parsedGdpB) * parsedStrength) / 100_000);
  assertSafeResults([income]);
  return income;
};

export const resolveQuarterEconomy = (input: QuarterEconomyInput): QuarterEconomyResult => {
  const parsed = QuarterEconomyInputSchema.parse(input);
  const taxRevenueCredits = Math.floor((parsed.gdpCredits * parsed.taxRateBps) / 10_000);
  const infrastructureGainBps = Math.min(500, parsed.railInvestmentCredits * 10);
  const gdpGainCredits = Math.floor(parsed.railInvestmentCredits / 10);
  const populationGrowth = Math.floor((parsed.population * parsed.annualGrowthBps) / 40_000);
  const treasuryCredits =
    parsed.treasuryCredits -
    parsed.railInvestmentCredits +
    parsed.tradeIncomeCredits +
    taxRevenueCredits -
    parsed.unitUpkeepCredits;
  if (treasuryCredits < 0) {
    throw new RangeError("Quarterly obligations exceed available treasury");
  }
  const result = Object.freeze({
    treasuryCredits,
    gdpCredits: parsed.gdpCredits + gdpGainCredits,
    infrastructureBps: Math.min(10_000, parsed.infrastructureBps + infrastructureGainBps),
    population: parsed.population + populationGrowth,
    taxRevenueCredits,
    populationGrowth,
  });
  assertSafeResults(Object.values(result));
  return result;
};
