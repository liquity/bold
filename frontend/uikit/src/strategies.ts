import type { Strategy, StrategyId } from "./types";

import strategyBunni from "./strategy-icons/bunni.png";
import strategyCamelot from "./strategy-icons/camelot.png";
import strategySpectra from "./strategy-icons/spectra.svg";
import strategyTeller from "./strategy-icons/teller.png";

export function isStrategyId(id: string): id is StrategyId {
  return (
    id === "bunni" 
    || id === "camelot" 
    || id === "spectra" 
    || id === "teller" 
  );
}

export const BUNNI: Strategy = {
  id: "bunni",
  icon: strategyBunni,
  name: "Bunni",
} as const;

export const CAMELOT: Strategy = {
  id: "camelot",
  icon: strategyCamelot,
  name: "Camelot",
} as const;

export const SPECTRA: Strategy = {
  id: "spectra",
  icon: strategySpectra,
  name: "Spectra",
} as const;

export const TELLER: Strategy = {
  id: "teller",
  icon: strategyTeller,
  name: "Teller",
} as const;

export const STRATEGIES: Strategy[] = [
  BUNNI,
  CAMELOT,
  SPECTRA,
  TELLER,
] as const;

export const STRATEGIES_BY_ID = {
  bunni: BUNNI,
  camelot: CAMELOT,
  spectra: SPECTRA,
  teller: TELLER,
} as const;
