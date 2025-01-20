"use client";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { noop } from "@/src/utils";
import { vPrefixedTroveId } from "@/src/valibot-utils";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as v from "valibot";

const STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}stored_state`;

export const StoredStateSchema = v.object({
  loanModes: v.record(
    vPrefixedTroveId(),
    v.union([
      v.literal("borrow"),
      v.literal("multiply"),
    ]),
  ),
  preferredApproveMethod: v.union([
    v.literal("permit"),
    v.literal("approve-amount"),
    v.literal("approve-infinite"),
  ]),
});

type StoredStateType = v.InferOutput<typeof StoredStateSchema>;

const defaultState: StoredStateType = {
  loanModes: {},
  preferredApproveMethod: "permit",
};

type StoredStateContext = StoredStateType & {
  setState: (
    stateUpdate:
      | Partial<StoredStateType>
      | ((state: StoredStateType) => Partial<StoredStateType>),
  ) => void;
  clearState: () => void;
};

const StoredStateContext = createContext<StoredStateContext>({
  ...defaultState,
  setState: noop,
  clearState: noop,
});

export function StoredState({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<StoredStateType>(() => {
    // try to restore the state from local storage
    try {
      return v.parse(
        StoredStateSchema,
        JSON.parse(
          (typeof localStorage !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null) ?? "",
        ),
      );
    } catch {
      return defaultState;
    }
  });

  // Save state to local storage
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const setStoredState = useCallback((
    stateUpdate:
      | Partial<StoredStateType>
      | ((state: StoredStateType) => Partial<StoredStateType>),
  ) => {
    if (typeof stateUpdate === "function") {
      stateUpdate = stateUpdate(state);
    }
    setState((state) => ({
      ...state,
      ...stateUpdate,
    }));
  }, [state]);

  const clearState = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState(defaultState);
  }, []);

  return (
    <StoredStateContext.Provider
      value={{
        ...state,
        setState: setStoredState,
        clearState,
      }}
    >
      {children}
    </StoredStateContext.Provider>
  );
}

export function useStoredState() {
  return useContext(StoredStateContext);
}
