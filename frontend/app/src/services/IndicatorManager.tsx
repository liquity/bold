"use client";

import type { ReactNode } from "react";

import { Indicator } from "@/src/comps/Indicator/Indicator";
import { useRpcIndicator } from "@/src/indicators/rpc-indicator";
import { useSubgraphIndicator } from "@/src/indicators/subgraph-indicator";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ErrorState = {
  message: ReactNode;
  successMessage?: string;
  timestamp: number;
};

const SUCCESS_MESSAGE_DURATION = 400;

const IndicatorContext = createContext<{
  clearError:
    | ((id: string) => void)
    | null;
  setError:
    | ((id: string, message: ReactNode, successMessage?: string) => void)
    | null;
}>({
  clearError: null,
  setError: null,
});

export function useIndicator() {
  const { setError, clearError } = useContext(IndicatorContext);
  if (!setError || !clearError) {
    throw new Error("useIndicator must be used within IndicatorProvider");
  }
  return useMemo(() => (
    { clearError, setError }
  ), [clearError, setError]);
}

function AllIndicators() {
  useSubgraphIndicator();
  useRpcIndicator();
  return null;
}

export function IndicatorManager({
  children,
}: {
  children: ReactNode;
}) {
  const [errors, setErrors] = useState<Map<string, ErrorState>>(new Map());

  const [currentSuccess, setCurrentSuccess] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSuccess = useCallback(() => {
    if (successTimer.current !== null) {
      clearTimeout(successTimer.current);
      successTimer.current = null;
    }
    setCurrentSuccess(null);
  }, []);

  const showSuccess = useCallback((message: string) => {
    clearSuccess();
    setCurrentSuccess(message);
    successTimer.current = setTimeout(() => {
      setCurrentSuccess(null);
    }, SUCCESS_MESSAGE_DURATION);
  }, [clearSuccess]);

  const setError = useCallback((
    id: string,
    message: ReactNode,
    successMessage?: string,
  ) => {
    setErrors((errors) => {
      const update = new Map(errors);
      update.set(id, {
        message,
        successMessage,
        timestamp: Date.now(),
      });
      return update;
    });
    clearSuccess();
  }, [clearSuccess]);

  const clearError = useCallback((id: string) => {
    setErrors((prevErrors) => {
      const errorState = prevErrors.get(id);
      const update = new Map(prevErrors);
      update.delete(id);
      
      // if this is the last error, show the success message
      if (errorState?.successMessage && prevErrors.size === 1) {
        showSuccess(errorState.successMessage);
      }
      
      return update;
    });
  }, [showSuccess]);

  const currentMessage = useMemo(() => {
    if (currentSuccess !== null) return currentSuccess;
    if (errors.size === 0) return null;
    return (
      Array
        .from(errors.values())
        .sort((a, b) => b.timestamp - a.timestamp)[0] as ErrorState
    ).message;
  }, [currentSuccess, errors]);

  useEffect(() => {
    return () => {
      if (successTimer.current !== null) {
        clearTimeout(successTimer.current);
      }
    };
  }, []);

  return (
    <IndicatorContext.Provider value={{ setError, clearError }}>
      <AllIndicators />
      {children}
      <Indicator message={currentMessage} />
    </IndicatorContext.Provider>
  );
}
