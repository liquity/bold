import { css } from "@/styled-system/css";
import { useDataSources } from "@/src/comps/DataSources/DataSources";
import { SHOW_DATA_SOURCES } from "@/src/env";
import { useIndicator } from "@/src/services/IndicatorManager";
import { useCallback, useEffect, useRef } from "react";
import { useBlockNumber } from "wagmi";

const REFETCH_INTERVAL = 10_000;

export function useRpcIndicator() {
  const indicator = useIndicator();
  const dataSources = useDataSources();
  const hasError = useRef(false);

  const { isError } = useBlockNumber({
    query: { refetchInterval: REFETCH_INTERVAL },
    watch: true,
  });

  const openDataSources = useCallback(() => {
    dataSources.openModal();
  }, [dataSources]);

  useEffect(() => {
    if (isError) {
      if (!hasError.current) {
        hasError.current = true;
        indicator.setError(
          "rpc-error",
          SHOW_DATA_SOURCES
            ? <RpcErrorMessage onClickSettings={openDataSources} />
            : "RPC connection error: unable to fetch data.",
          "RPC connected.",
        );
      }
    } else {
      if (hasError.current) {
        hasError.current = false;
        indicator.clearError("rpc-error");
      }
    }
  }, [isError, indicator, openDataSources]);
}

function RpcErrorMessage({ onClickSettings }: { onClickSettings: () => void }) {
  return (
    <span>
      RPC connection error.{" "}
      <button
        onClick={onClickSettings}
        className={css({
          textDecoration: "underline",
          cursor: "pointer",
          background: "none",
          border: "none",
          color: "inherit",
          font: "inherit",
          padding: 0,
        })}
      >
        Change RPC URL
      </button>
    </span>
  );
}
