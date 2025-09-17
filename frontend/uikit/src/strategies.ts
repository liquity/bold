import type { Strategy, StrategyId } from "./types";

import strategyBalancer from "./strategy-icons/balancer.svg";
import strategyCamelot from "./strategy-icons/camelot.png";
import strategySpectra from "./strategy-icons/spectra.svg";
import strategyTeller from "./strategy-icons/teller.png";

export function isStrategyId(id: string): id is StrategyId {
  return (
    id === "balancer"
    || id === "camelot" 
    || id === "spectra" 
    || id === "teller" 
  );
}

export const BALANCER: Strategy = {
  id: "balancer",
  icon: strategyBalancer,
  name: "Balancer",
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
  BALANCER,
  CAMELOT,
  SPECTRA,
  TELLER,
] as const;

export const STRATEGIES_BY_ID = {
  balancer: BALANCER,
  camelot: CAMELOT,
  spectra: SPECTRA,
  teller: TELLER,
} as const;
