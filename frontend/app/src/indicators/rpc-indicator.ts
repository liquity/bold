import { useIndicator } from "@/src/services/IndicatorManager";
import { useEffect, useRef } from "react";
import { useBlockNumber } from "wagmi";

const REFETCH_INTERVAL = 10_000;

export function useRpcIndicator() {
  const indicator = useIndicator();
  const hasError = useRef(false);

  const { isError } = useBlockNumber({
    query: { refetchInterval: REFETCH_INTERVAL },
    watch: true,
  });

  useEffect(() => {
    if (isError) {
      if (!hasError.current) {
        hasError.current = true;
        indicator.setError(
          "rpc-error",
          "RPC connection error: unable to fetch data.",
          "RPC connected.",
        );
      }
    } else {
      if (hasError.current) {
        hasError.current = false;
        indicator.clearError("rpc-error");
      }
    }
  }, [isError, indicator]);
}
