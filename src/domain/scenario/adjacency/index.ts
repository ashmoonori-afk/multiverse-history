import { z } from "zod";

import bronze1200bc from "./scn_bronze_1200bc.json";
import classical117 from "./scn_classical_117.json";
import coldwar1962 from "./scn_coldwar_1962.json";
import ea1900 from "./scn_ea1900.json";
import medieval1200 from "./scn_medieval_1200.json";
import modern from "./scn_modern.json";
import reconstruction2281 from "./scn_reconstruction_2281.json";
import steppe1300 from "./scn_steppe_1300.json";
import trade1650 from "./scn_trade_1650.json";
import world1939 from "./scn_world_1939.json";

const AdjacencySchema = z.record(z.string(), z.array(z.string()));

export type ScenarioAdjacency = Readonly<Record<string, readonly string[]>>;

const parseAdjacency = (value: unknown): ScenarioAdjacency =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(AdjacencySchema.parse(value)).map(([provinceId, neighbors]) => [
        provinceId,
        Object.freeze(neighbors),
      ]),
    ),
  );

const adjacencyByScenarioId = Object.freeze({
  scn_bronze_1200bc: parseAdjacency(bronze1200bc),
  scn_classical_117: parseAdjacency(classical117),
  scn_medieval_1200: parseAdjacency(medieval1200),
  scn_steppe_1300: parseAdjacency(steppe1300),
  scn_trade_1650: parseAdjacency(trade1650),
  scn_ea1900: parseAdjacency(ea1900),
  scn_world_1939: parseAdjacency(world1939),
  scn_coldwar_1962: parseAdjacency(coldwar1962),
  scn_modern: parseAdjacency(modern),
  scn_reconstruction_2281: parseAdjacency(reconstruction2281),
} satisfies Readonly<Record<string, ScenarioAdjacency>>);

export const getScenarioAdjacency = (scenarioId: string): ScenarioAdjacency =>
  adjacencyByScenarioId[scenarioId as keyof typeof adjacencyByScenarioId] ?? Object.freeze({});
