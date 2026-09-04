import { useEffect, useState } from "react";

import { loadHistoricalMapCollection } from "./historical-map";
import { emptyRawCollection, type RawCollection } from "./open-historia-map-data";

interface HistoricalScenarioMapState {
  readonly collection: RawCollection | undefined;
  readonly ready: boolean;
  readonly error: boolean;
}

export const useHistoricalScenarioMap = (scenarioId: string): HistoricalScenarioMapState => {
  const isCurated1900 = scenarioId === "scn_ea1900";
  const [state, setState] = useState<HistoricalScenarioMapState>({
    collection: isCurated1900 ? undefined : emptyRawCollection,
    ready: isCurated1900,
    error: false,
  });

  useEffect(() => {
    let active = true;
    if (isCurated1900) {
      setState({ collection: undefined, ready: true, error: false });
      return () => {
        active = false;
      };
    }
    setState({ collection: emptyRawCollection, ready: false, error: false });
    void loadHistoricalMapCollection(scenarioId)
      .then((collection) => {
        if (active) setState({ collection, ready: true, error: false });
      })
      .catch(() => {
        if (active) {
          setState({ collection: emptyRawCollection, ready: true, error: true });
        }
      });
    return () => {
      active = false;
    };
  }, [isCurated1900, scenarioId]);

  return state;
};
