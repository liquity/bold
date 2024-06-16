"use client";

import type { ReactNode } from "react";

import { createContext, useCallback, useContext, useState } from "react";
import { z } from "zod";

const DEMO_STATE_KEY = "liquity2:demo-state";

export const DemoStateSchema = z.object({
  account: z.object({
    isConnected: z.boolean(),
  }),
});

type DemoState = z.infer<typeof DemoStateSchema>;

type DemoStateContext = DemoState & {
  clearDemoState: () => void;
  setDemoState: (state: Partial<DemoState>) => void;
};

const demoStateDefault: DemoState = {
  account: {
    isConnected: false,
  },
};

const DemoContext = createContext<DemoStateContext>({
  ...demoStateDefault,
  clearDemoState: () => {},
  setDemoState: () => {},
});

export function DemoState({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<DemoState>(() => {
    const storedState = typeof localStorage !== "undefined"
      ? localStorage.getItem(DEMO_STATE_KEY)
      : null;
    if (storedState) {
      try {
        return DemoStateSchema.parse(JSON.parse(storedState));
      } catch {
        return demoStateDefault;
      }
    }
    return demoStateDefault;
  });

  const setDemoState = useCallback((state: Partial<DemoState>) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
    }
    setState((c) => ({
      ...c,
      ...state,
    }));
  }, []);

  const clearDemoState = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DEMO_STATE_KEY);
    }
    setState(demoStateDefault);
  }, []);

  return (
    <DemoContext.Provider
      value={{
        ...state,
        clearDemoState,
        setDemoState,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoState() {
  return useContext(DemoContext);
}
