import { useIndicator } from "@/src/services/IndicatorManager";
import { useEffect, useRef } from "react";
import { useBlockNumber } from "wagmi";

const MAX_CONSECUTIVE_FAILURES = 2;
const REFETCH_INTERVAL = 10_000;

export function useRpcIndicator() {
  const indicator = useIndicator();
  const consecutiveFailures = useRef(0);
  const hasError = useRef(false);

  const { isError } = useBlockNumber({
    query: { refetchInterval: REFETCH_INTERVAL },
    watch: true,
  });

  useEffect(() => {
    if (isError) {
      consecutiveFailures.current += 1;
      if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES && !hasError.current) {
        hasError.current = true;
        indicator.setError(
          "rpc-error",
          "RPC connection error: unable to fetch data.",
          "RPC connected.",
        );
      }
    } else {
      consecutiveFailures.current = 0;
      if (hasError.current) {
        hasError.current = false;
        indicator.clearError("rpc-error");
      }
    }
  }, [isError, indicator]);
}