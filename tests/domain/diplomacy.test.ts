import { describe, expect, test } from "bun:test";

import {
  acceptTreaty,
  assertWarDeclarationLegal,
  proposeTreaty,
  relationAfterWarDeclaration,
} from "../../src/domain/diplomacy/treaties";
import { parseNationId } from "../../src/shared/ids";

const korea = parseNationId("nat_kor");
const japan = parseNationId("nat_jpn");
const qing = parseNationId("nat_qing");

describe("diplomacy and treaty rules", () => {
  test("creates a proposed trade treaty without activating it", () => {
    // Given
    const input = {
      id: "try_kor_jpn_trade",
      proposerNationId: korea,
      recipientNationId: japan,
      clauses: ["trade"] as const,
      turn: 0,
    };

    // When
    const treaty = proposeTreaty(input);

    // Then
    expect(treaty.status).toBe("proposed");
    expect(treaty.clauses).toEqual(["trade"]);
    expect(treaty.activatedTurn).toBeUndefined();
  });

  test("allows only the recipient to activate a proposed treaty", () => {
    // Given
    const proposal = proposeTreaty({
      id: "try_kor_qing_alliance",
      proposerNationId: korea,
      recipientNationId: qing,
      clauses: ["alliance"],
      turn: 1,
    });

    // When
    const alliance = acceptTreaty({ treaty: proposal, actorNationId: qing, turn: 2 });
    const acceptAsProposer = () =>
      acceptTreaty({ treaty: proposal, actorNationId: korea, turn: 2 });

    // Then
    expect(alliance.status).toBe("active");
    expect(alliance.activatedTurn).toBe(2);
    expect(acceptAsProposer).toThrow("Only the recipient can accept a treaty");
  });

  test("blocks war against active allies and non-aggression partners", () => {
    // Given
    const alliance = acceptTreaty({
      treaty: proposeTreaty({
        id: "try_kor_qing_alliance",
        proposerNationId: korea,
        recipientNationId: qing,
        clauses: ["alliance"],
        turn: 1,
      }),
      actorNationId: qing,
      turn: 2,
    });

    // When
    const declareWar = () => assertWarDeclarationLegal(korea, qing, [alliance]);

    // Then
    expect(declareWar).toThrow("ALLY_WAR_BLOCKED");
  });

  test("permits war against a non-ally and applies a bounded relation penalty", () => {
    // Given
    const currentRelation = 250;

    // When
    assertWarDeclarationLegal(korea, japan, []);
    const nextRelation = relationAfterWarDeclaration(currentRelation);
    const boundedRelation = relationAfterWarDeclaration(-9_000);

    // Then
    expect(nextRelation).toBe(-3_750);
    expect(boundedRelation).toBe(-10_000);
  });
});
