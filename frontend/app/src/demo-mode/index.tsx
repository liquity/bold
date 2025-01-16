"use client";

import type { Address } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { DEMO_MODE } from "@/src/env";
import { noop } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as v from "valibot";
export * from "./demo-data";

const DEMO_STATE_KEY = `${LOCAL_STORAGE_PREFIX}demo_state`;

const DEMO_ACCOUNT: Address = "0x1234567890123456789012345678901234567890";
const DEMO_ENS_NAME = "demo.eth";

const Accountschema = v.object({
  address: v.undefined(),
  addresses: v.undefined(),
  chain: v.undefined(),
  chainId: v.number(),
  connector: v.undefined(),
  ensName: v.union([v.string(), v.undefined()]),
  isConnected: v.literal(false),
  isConnecting: v.literal(false),
  isDisconnected: v.literal(false),
  isReconnecting: v.literal(false),
});

export const DemoModeStateSchema = v.object({
  account: v.union([
    v.object({
      ...Accountschema.entries,
      address: vAddress(),
      addresses: v.tupleWithRest([vAddress()], vAddress()),
      isConnected: v.literal(true),
      status: v.literal("connected"),
    }),
    v.object({
      ...Accountschema.entries,
      isDisconnected: v.literal(true),
      status: v.literal("disconnected"),
    }),
    v.object({
      ...Accountschema.entries,
      address: vAddress(),
      addresses: v.tupleWithRest([vAddress()], vAddress()),
      isConnecting: v.literal(true),
      status: v.literal("connecting"),
    }),
    v.object({
      ...Accountschema.entries,
      address: vAddress(),
      addresses: v.tupleWithRest([vAddress()], vAddress()),
      isReconnecting: v.literal(true),
      status: v.literal("reconnecting"),
    }),
  ]),
});

type DemoModeState = v.InferOutput<typeof DemoModeStateSchema>;

type DemoModeContext = DemoModeState & {
  account: DemoModeState["account"] & {
    connect: () => void;
    disconnect: () => void;
    safeStatus: null;
  };
  clearDemoMode: () => void;
  enabled: boolean;
  setDemoModeState: (state: Partial<DemoModeState>) => void;
  updateAccountConnected: (connect: boolean) => void;
};

const demoModeStateDefault: DemoModeState = {
  account: {
    address: DEMO_ACCOUNT,
    addresses: [DEMO_ACCOUNT],
    chain: undefined,
    chainId: 1,
    connector: undefined,
    ensName: DEMO_ENS_NAME,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: "connected",
  },
};

const DemoContext = createContext<DemoModeContext>({
  ...demoModeStateDefault,
  account: {
    ...demoModeStateDefault.account,
    connect: noop,
    disconnect: noop,
    safeStatus: null,
  },
  clearDemoMode: noop,
  enabled: DEMO_MODE,
  setDemoModeState: noop,
  updateAccountConnected: noop,
});

const DemoStorage = {
  get: (): DemoModeState | null => {
    if (!DEMO_MODE || typeof localStorage === "undefined") {
      return null;
    }
    const storedState = localStorage.getItem(DEMO_STATE_KEY);
    if (storedState) {
      try {
        return v.parse(DemoModeStateSchema, JSON.parse(storedState));
      } catch {
        return null;
      }
    }
    return null;
  },
  set: (state: DemoModeState) => {
    if (DEMO_MODE && typeof localStorage !== "undefined") {
      localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
    }
  },
  clear: () => {
    if (DEMO_MODE && typeof localStorage !== "undefined") {
      localStorage.removeItem(DEMO_STATE_KEY);
    }
  },
};

export function DemoMode({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<DemoModeState>(() => DemoStorage.get() ?? demoModeStateDefault);

  // save state to storage
  useEffect(() => {
    DemoStorage.set(state);
  }, [state]);

  const setDemoModeState = useCallback((
    stateUpdate:
      | Partial<DemoModeState>
      | ((state: DemoModeState) => Partial<DemoModeState>),
  ) => {
    if (typeof stateUpdate === "function") {
      stateUpdate = stateUpdate(state);
    }
    setState((state) => ({
      ...state,
      ...stateUpdate,
    }));
  }, []);

  const clearDemoMode = useCallback(() => {
    DemoStorage.clear();
    setState(demoModeStateDefault);
  }, []);

  const updateAccountConnected = useCallback((connect: boolean) => {
    setDemoModeState((state) => ({
      ...state,
      account: {
        ...state.account,
        ...(
          connect
            ? {
              address: DEMO_ACCOUNT,
              addresses: [DEMO_ACCOUNT],
              ensName: DEMO_ENS_NAME,
              isConnected: true,
              isConnecting: false,
              isDisconnected: false,
              isReconnecting: false,
              status: "connected",
            }
            : {
              address: undefined,
              addresses: undefined,
              ensName: undefined,
              isConnected: false,
              isConnecting: false,
              isDisconnected: true,
              isReconnecting: false,
              status: "disconnected",
            }
        ),
      },
    }));
  }, [setDemoModeState]);

  const connect = () => updateAccountConnected(true);
  const disconnect = () => updateAccountConnected(false);

  return (
    <DemoContext.Provider
      value={{
        ...state,
        account: {
          ...state.account,
          connect,
          disconnect,
          safeStatus: null,
        },
        clearDemoMode,
        enabled: DEMO_MODE,
        setDemoModeState,
        updateAccountConnected,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoContext);
}
