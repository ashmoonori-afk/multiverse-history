export type ChronicleEvent =
  | {
      readonly type: "economy";
      readonly turn: number;
      readonly actorNameKo: string;
      readonly investmentCredits: number;
      readonly infrastructureGainBps: number;
    }
  | {
      readonly type: "combat";
      readonly turn: number;
      readonly provinceNameKo: string;
      readonly attackerNameKo: string;
      readonly defenderNameKo: string;
      readonly attackerWon: boolean;
      readonly attackerCasualties: number;
      readonly defenderCasualties: number;
    }
  | {
      readonly type: "treaty";
      readonly turn: number;
      readonly proposerNameKo: string;
      readonly recipientNameKo: string;
      readonly clauseNameKo: string;
      readonly status: "proposed" | "active";
    };

export interface ChronicleEntry {
  readonly turn: number;
  readonly source: "deterministic";
  readonly textKo: string;
}

const escapeText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatInteger = (value: number): string => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Chronicle numbers must be non-negative safe integers");
  }
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const renderEconomy = (event: Extract<ChronicleEvent, { readonly type: "economy" }>): string =>
  `${escapeText(event.actorNameKo)}은 철도망에 ${formatInteger(
    event.investmentCredits,
  )} 크레딧을 투자해 기반시설을 ${formatInteger(event.infrastructureGainBps)}bp 확충했다.`;

const renderCombat = (event: Extract<ChronicleEvent, { readonly type: "combat" }>): string => {
  const winner = escapeText(event.attackerWon ? event.attackerNameKo : event.defenderNameKo);
  const loser = escapeText(event.attackerWon ? event.defenderNameKo : event.attackerNameKo);
  return `${escapeText(
    event.provinceNameKo,
  )} 전투에서 ${winner}이 ${loser}을 격파했다. ${escapeText(
    event.attackerNameKo,
  )} ${formatInteger(event.attackerCasualties)}명, ${escapeText(
    event.defenderNameKo,
  )} ${formatInteger(event.defenderCasualties)}명의 손실이 발생했다.`;
};

const renderTreaty = (event: Extract<ChronicleEvent, { readonly type: "treaty" }>): string => {
  const verb = event.status === "proposed" ? "제안했다" : "발효했다";
  return `${escapeText(event.proposerNameKo)}은 ${escapeText(
    event.recipientNameKo,
  )}에 ${escapeText(event.clauseNameKo)} 협정을 ${verb}.`;
};

const renderText = (event: ChronicleEvent): string => {
  switch (event.type) {
    case "economy":
      return renderEconomy(event);
    case "combat":
      return renderCombat(event);
    case "treaty":
      return renderTreaty(event);
  }
};

export const renderChronicle = (event: ChronicleEvent): ChronicleEntry => {
  if (!Number.isSafeInteger(event.turn) || event.turn < 0) {
    throw new RangeError("Chronicle turn must be a non-negative safe integer");
  }
  return Object.freeze({
    turn: event.turn,
    source: "deterministic",
    textKo: renderText(event),
  });
};
