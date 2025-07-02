import { useIndicator } from "@/src/services/IndicatorManager";
import { useEffect } from "react";

let errorMessage: string | null = null;
const listeners = new Set<(error: string | null) => void>();

// used by graphQuery() in subgraph.ts
export const subgraphIndicator = {
  setError: (message: string) => {
    errorMessage = message;
    listeners.forEach((listener) => listener(errorMessage));
  },
  clearError: () => {
    errorMessage = null;
    listeners.forEach((listener) => listener(errorMessage));
  },
};

export function useSubgraphIndicator() {
  const indicator = useIndicator();

  useEffect(() => {
    const update = (errorMessage: string | null) => {
      if (errorMessage) {
        indicator.setError("subgraph-error", errorMessage, "Subgraph connected.");
      } else {
        indicator.clearError("subgraph-error");
      }
    };

    update(errorMessage);
    listeners.add(update);

    return () => {
      listeners.delete(update);
    };
  }, [indicator]);
}
