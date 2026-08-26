import { describe, expect, test } from "bun:test";

import { renderChronicle } from "../../src/domain/events/chronicle";

describe("deterministic Korean chronicle", () => {
  test("renders the Korean rail investment outcome exactly", () => {
    // Given
    const event = {
      type: "economy" as const,
      turn: 1,
      actorNameKo: "대한제국",
      investmentCredits: 25,
      infrastructureGainBps: 250,
    };

    // When
    const chronicle = renderChronicle(event);

    // Then
    expect(chronicle).toEqual({
      turn: 1,
      source: "deterministic",
      textKo: "대한제국은 철도망에 25 크레딧을 투자해 기반시설을 250bp 확충했다.",
    });
  });

  test("renders deterministic battle casualties with Korean number grouping", () => {
    // Given
    const event = {
      type: "combat" as const,
      turn: 3,
      provinceNameKo: "연해주",
      attackerNameKo: "대한제국",
      defenderNameKo: "러시아제국",
      attackerWon: true,
      attackerCasualties: 772,
      defenderCasualties: 2_206,
    };

    // When
    const chronicle = renderChronicle(event);

    // Then
    expect(chronicle.textKo).toBe(
      "연해주 전투에서 대한제국이 러시아제국을 격파했다. 대한제국 772명, 러시아제국 2,206명의 손실이 발생했다.",
    );
  });

  test("escapes authored names instead of emitting executable markup", () => {
    // Given
    const event = {
      type: "treaty" as const,
      turn: 2,
      proposerNameKo: "<script>대한제국</script>",
      recipientNameKo: "일본제국",
      clauseNameKo: "통상",
      status: "proposed" as const,
    };

    // When
    const chronicle = renderChronicle(event);

    // Then
    expect(chronicle.textKo).not.toContain("<script>");
    expect(chronicle.textKo).toContain("&lt;script&gt;대한제국&lt;/script&gt;");
  });
});
