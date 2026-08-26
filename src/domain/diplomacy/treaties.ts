import { z } from "zod";

import type { NationId } from "../../shared/ids";

export type TreatyStatus = "proposed" | "active" | "rejected" | "terminated";
export type TreatyClause = "alliance" | "non_aggression" | "trade" | "military_access";

export interface Treaty {
  readonly id: string;
  readonly proposerNationId: NationId;
  readonly participantNationIds: readonly [NationId, NationId];
  readonly clauses: readonly TreatyClause[];
  readonly status: TreatyStatus;
  readonly proposedTurn: number;
  readonly activatedTurn?: number;
}

export interface ProposeTreatyInput {
  readonly id: string;
  readonly proposerNationId: NationId;
  readonly recipientNationId: NationId;
  readonly clauses: readonly TreatyClause[];
  readonly turn: number;
}

export interface AcceptTreatyInput {
  readonly treaty: Treaty;
  readonly actorNationId: NationId;
  readonly turn: number;
}

const TreatyIdSchema = z.string().regex(/^try_[a-z0-9_]+$/);
const TurnSchema = z.number().safe().int().min(0);
const RelationSchema = z.number().safe().int().min(-10_000).max(10_000);
const supportedClauses = new Set<TreatyClause>([
  "alliance",
  "non_aggression",
  "trade",
  "military_access",
]);

const assertClauses = (clauses: readonly TreatyClause[]): void => {
  if (
    clauses.length === 0 ||
    new Set(clauses).size !== clauses.length ||
    clauses.some((clause) => !supportedClauses.has(clause))
  ) {
    throw new RangeError("Treaty clauses must be unique and supported");
  }
};

export const proposeTreaty = (input: ProposeTreatyInput): Treaty => {
  TreatyIdSchema.parse(input.id);
  TurnSchema.parse(input.turn);
  assertClauses(input.clauses);
  if (input.proposerNationId === input.recipientNationId) {
    throw new RangeError("Treaty participants must be distinct");
  }
  const participantNationIds: readonly [NationId, NationId] = Object.freeze([
    input.proposerNationId,
    input.recipientNationId,
  ]);
  return Object.freeze({
    id: input.id,
    proposerNationId: input.proposerNationId,
    participantNationIds,
    clauses: Object.freeze([...input.clauses]),
    status: "proposed",
    proposedTurn: input.turn,
  });
};

export const acceptTreaty = (input: AcceptTreatyInput): Treaty => {
  TurnSchema.parse(input.turn);
  if (input.treaty.status !== "proposed") {
    throw new RangeError("Only proposed treaties can be accepted");
  }
  const recipientNationId = input.treaty.participantNationIds[1];
  if (input.actorNationId !== recipientNationId) {
    throw new RangeError("Only the recipient can accept a treaty");
  }
  if (input.turn < input.treaty.proposedTurn) {
    throw new RangeError("Treaty activation cannot predate its proposal");
  }
  return Object.freeze({
    ...input.treaty,
    status: "active",
    activatedTurn: input.turn,
  });
};

export const assertWarDeclarationLegal = (
  actorNationId: NationId,
  targetNationId: NationId,
  treaties: readonly Treaty[],
): void => {
  if (actorNationId === targetNationId) {
    throw new RangeError("A nation cannot declare war on itself");
  }
  const isBlocked = treaties.some(
    (treaty) =>
      treaty.status === "active" &&
      treaty.participantNationIds.includes(actorNationId) &&
      treaty.participantNationIds.includes(targetNationId) &&
      treaty.clauses.some((clause) => clause === "alliance" || clause === "non_aggression"),
  );
  if (isBlocked) {
    throw new RangeError("ALLY_WAR_BLOCKED");
  }
};

export const relationAfterWarDeclaration = (currentRelation: number): number =>
  Math.max(-10_000, RelationSchema.parse(currentRelation) - 4_000);
