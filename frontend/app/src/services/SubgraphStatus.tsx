"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

type SubgraphStatus = {
  hasError: boolean;
  errors: { id: string, error: Error }[];
  setError: (id: string, error: Error) => void;
  clearError: (id: string) => void;
  clearAllErrors: () => void;
};

const SubgraphErrorContext = createContext<SubgraphStatus | undefined>(undefined);

export const SubgraphStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errors, setErrorState] = useState<{ id: string, error: Error }[]>([]);

  const setError = useCallback((id: string, err: Error) => {
    const existingError = errors.find(e => e.id === id);
    if (existingError) {
      setErrorState(errors.map(e => e.id === id ? { ...e, error: err } : e));
    } else {
      setErrorState([...errors, { id, error: err }]);
    }
  }, []);

  const clearError = useCallback((id: string) => {
    const exists = errors.find(e => e.id === id);
    if (exists) {
      setErrorState(errors.filter(e => e.id !== id));
    }
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrorState([]);
  }, []);

  const value = useMemo(
    () => ({
      hasError: errors.length > 0,
      errors,
      setError,
      clearError,
      clearAllErrors,
    }),
    [errors, setError, clearError, clearAllErrors]
  );

  return (
    <SubgraphErrorContext.Provider value={value}>
      {children}
    </SubgraphErrorContext.Provider>
  );
};

export function SubgraphStatus({ children }: { children: React.ReactNode }) {
  return (
    <SubgraphStatusProvider>
      {children}
    </SubgraphStatusProvider>
  );
}

export function useSubgraphStatus() {
  const context = useContext(SubgraphErrorContext);
  if (context === undefined) {
    throw new Error("useSubgraphErrorState must be used within a SubgraphErrorProvider");
  }
  return context;
}
