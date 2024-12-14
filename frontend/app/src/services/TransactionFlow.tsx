"use client";

import type { Contracts } from "@/src/contracts";
import type { Address } from "@/src/types";
import type { ComponentType, ReactNode } from "react";
import type { Config as WagmiConfig } from "wagmi";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { getContracts } from "@/src/contracts";
import { jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useStoredState } from "@/src/services/StoredState";
import { noop } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { useAccount, useConfig as useWagmiConfig } from "wagmi";

/* flows registration */

import { claimCollateralSurplus, type ClaimCollateralSurplusRequest } from "@/src/tx-flows/claimCollateralSurplus";
import { closeLoanPosition, type CloseLoanPositionRequest } from "@/src/tx-flows/closeLoanPosition";
import { earnClaimRewards, type EarnClaimRewardsRequest } from "@/src/tx-flows/earnClaimRewards";
import { earnDeposit, type EarnDepositRequest } from "@/src/tx-flows/earnDeposit";
import { earnWithdraw, type EarnWithdrawRequest } from "@/src/tx-flows/earnWithdraw";
import { openBorrowPosition, type OpenBorrowPositionRequest } from "@/src/tx-flows/openBorrowPosition";
import { openLeveragePosition, type OpenLeveragePositionRequest } from "@/src/tx-flows/openLeveragePosition";
import { stakeClaimRewards, type StakeClaimRewardsRequest } from "@/src/tx-flows/stakeClaimRewards";
import { stakeDeposit, type StakeDepositRequest } from "@/src/tx-flows/stakeDeposit";
import { unstakeDeposit, type UnstakeDepositRequest } from "@/src/tx-flows/unstakeDeposit";
import { updateBorrowPosition, type UpdateBorrowPositionRequest } from "@/src/tx-flows/updateBorrowPosition";
import { updateLeveragePosition, type UpdateLeveragePositionRequest } from "@/src/tx-flows/updateLeveragePosition";
import { updateLoanInterestRate, type UpdateLoanInterestRateRequest } from "@/src/tx-flows/updateLoanInterestRate";

export type FlowRequestMap = {
  "claimCollateralSurplus": ClaimCollateralSurplusRequest;
  "closeLoanPosition": CloseLoanPositionRequest;
  "earnClaimRewards": EarnClaimRewardsRequest;
  "earnDeposit": EarnDepositRequest;
  "earnWithdraw": EarnWithdrawRequest;
  "openBorrowPosition": OpenBorrowPositionRequest;
  "openLeveragePosition": OpenLeveragePositionRequest;
  "stakeClaimRewards": StakeClaimRewardsRequest;
  "stakeDeposit": StakeDepositRequest;
  "unstakeDeposit": UnstakeDepositRequest;
  "updateBorrowPosition": UpdateBorrowPositionRequest;
  "updateLeveragePosition": UpdateLeveragePositionRequest;
  "updateLoanInterestRate": UpdateLoanInterestRateRequest;
};

const FlowIdSchema = v.union([
  v.literal("claimCollateralSurplus"),
  v.literal("closeLoanPosition"),
  v.literal("earnClaimRewards"),
  v.literal("earnDeposit"),
  v.literal("earnWithdraw"),
  v.literal("openBorrowPosition"),
  v.literal("openLeveragePosition"),
  v.literal("stakeClaimRewards"),
  v.literal("stakeDeposit"),
  v.literal("unstakeDeposit"),
  v.literal("updateBorrowPosition"),
  v.literal("updateLeveragePosition"),
  v.literal("updateLoanInterestRate"),
]);

export const flows: FlowsMap = {
  claimCollateralSurplus,
  closeLoanPosition,
  earnClaimRewards,
  earnDeposit,
  earnWithdraw,
  openBorrowPosition,
  openLeveragePosition,
  stakeClaimRewards,
  stakeDeposit,
  unstakeDeposit,
  updateBorrowPosition,
  updateLeveragePosition,
  updateLoanInterestRate,
};

/* end of flows registration */

const TRANSACTION_FLOW_KEY = `${LOCAL_STORAGE_PREFIX}transaction_flow`;

type FlowsMap = {
  [K in keyof FlowRequestMap]: FlowDeclaration<FlowRequestMap[K]>;
};

export type FlowStepStatus =
  | "idle"
  | "awaiting-commit"
  | "awaiting-verify"
  | "confirmed"
  | "error";

export type FlowStep = {
  // artifact is the result of a step,
  // e.g. a transaction hash or a signed message
  artifact: string | null;
  error: string | null;
  id: string;
  status: FlowStepStatus;
};

// implemented by all flow requests
export interface BaseFlowRequest {
  flowId: keyof FlowRequestMap;
  backLink: [path: string, label: string] | null;
  successLink: [path: string, label: string];
  successMessage: string;
}

// individual step in a flow
export type FlowStepDeclaration<FlowRequest extends BaseFlowRequest = BaseFlowRequest> = {
  name: (params: FlowParams<FlowRequest>) => string;
  commit: (params: FlowParams<FlowRequest>) => Promise<string | null>;
  verify: (params: FlowParams<FlowRequest>, artifact: string) => Promise<void>;
  Status: ComponentType<
    | { status: "idle" | "awaiting-commit" }
    | { status: "awaiting-verify" | "confirmed"; artifact: string }
    | { status: "error"; error: string; artifact?: string }
  >;
};

export type FlowDeclaration<FlowRequest extends BaseFlowRequest> = {
  title: ReactNode;
  Summary: ComponentType<{ request: FlowRequest; steps: FlowStep[] | null }>;
  Details: ComponentType<{ request: FlowRequest; steps: FlowStep[] | null }>;
  steps: Record<string, FlowStepDeclaration<FlowRequest>>;
  getSteps: (params: FlowParams<FlowRequest>) => Promise<string[]>;
  parseRequest: (request: unknown) => FlowRequest | null;
};

// passed to the react context + saved in local storage
export type Flowstate<FlowRequest extends BaseFlowRequest = BaseFlowRequest> = {
  account: Address | null;
  request: FlowRequest;
  steps: FlowStep[] | null;
};

// passed to the step functions
export type FlowParams<FlowRequest extends BaseFlowRequest = BaseFlowRequest> = {
  account: Address | null;
  contracts: Contracts;
  request: FlowRequest;
  steps: FlowStep[] | null;
  storedState: ReturnType<typeof useStoredState>;
  wagmiConfig: WagmiConfig;
};

// flow state as stored in local storage
const FlowStateSchema = v.object({
  account: vAddress(),
  request: v.looseObject({
    flowId: FlowIdSchema,
    backLink: v.union([
      v.null(),
      v.tuple([v.string(), v.string()]),
    ]),
    successLink: v.tuple([v.string(), v.string()]),
    successMessage: v.string(),
  }),
  steps: v.union([
    v.null(),
    v.array(v.object({
      id: v.string(),
      status: v.union([
        v.literal("idle"),
        v.literal("awaiting-commit"),
        v.literal("awaiting-verify"),
        v.literal("confirmed"),
        v.literal("error"),
      ]),
      artifact: v.union([v.string(), v.null()]),
      error: v.union([v.string(), v.null()]),
    })),
  ]),
});

export function getFlowDeclaration<K extends keyof FlowRequestMap>(
  flowId: K,
): FlowDeclaration<FlowRequestMap[K]> | null {
  return flows[flowId] ?? null;
}

// flow react context
type TransactionFlowContext<
  FlowRequest extends FlowRequestMap[keyof FlowRequestMap] = FlowRequestMap[keyof FlowRequestMap],
> = {
  currentStep: FlowStep | null;
  currentStepIndex: number;
  discard: () => void;
  commit: () => Promise<void>;
  start: (request: FlowRequest) => void;
  flow: Flowstate<FlowRequest> | null;
  flowDeclaration: FlowDeclaration<FlowRequest> | null;
  flowParams: FlowParams<FlowRequest> | null;
};

const TransactionFlowContext = createContext<TransactionFlowContext>({
  currentStep: null,
  currentStepIndex: -1,
  discard: noop,
  commit: async () => {},
  start: noop,
  flow: null,
  flowDeclaration: null,
  flowParams: null,
});

export function TransactionFlow({
  children,
}: {
  children: ReactNode;
}) {
  const account = useAccount();
  const router = useRouter();
  const storedState = useStoredState();
  const wagmiConfig = useWagmiConfig();

  const {
    currentStep,
    currentStepIndex,
    discardFlow,
    flow,
    flowDeclaration,
    startFlow,
    updateFlowStep,
  } = useFlowManager(account.address ?? null);

  const commit = useCallback(async () => {
    if (!flow || !flowDeclaration || !currentStep || currentStepIndex === -1) {
      return;
    }

    const stepDef = flowDeclaration.steps[currentStep.id];
    if (!stepDef) return;

    updateFlowStep(currentStepIndex, {
      status: "awaiting-commit",
      artifact: null,
      error: null,
    });

    try {
      if (!account.address) {
        throw new Error("Account address is required");
      }

      const params: FlowParams<FlowRequestMap[keyof FlowRequestMap]> = {
        account: account.address,
        contracts: getContracts(),
        request: flow.request,
        steps: flow.steps,
        storedState,
        wagmiConfig,
      };

      const artifact = await stepDef.commit(params);
      if (artifact === null) {
        throw new Error("Commit failed - no artifact returned");
      }

      updateFlowStep(currentStepIndex, {
        status: "awaiting-verify",
        artifact,
        error: null,
      });

      try {
        await stepDef.verify(params, artifact);
        updateFlowStep(currentStepIndex, {
          status: "confirmed",
          artifact,
          error: null,
        });
      } catch (error) {
        updateFlowStep(currentStepIndex, {
          status: "error",
          artifact,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      updateFlowStep(currentStepIndex, {
        status: "error",
        artifact: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    flow,
    flowDeclaration,
    currentStep,
    currentStepIndex,
    account.address,
    storedState,
    wagmiConfig,
    updateFlowStep,
  ]);

  const start: TransactionFlowContext["start"] = useCallback((request) => {
    if (account.address) {
      startFlow(request, account.address);
      setTimeout(() => {
        router.push("/transactions");
      }, 0);
    }
  }, [account.address, startFlow, router]);

  return (
    <TransactionFlowContext.Provider
      value={{
        currentStep,
        currentStepIndex,
        discard: discardFlow,
        commit,
        start,
        flow,
        flowDeclaration,
        flowParams: flow && account.address
          ? {
            ...flow,
            contracts: getContracts(),
            account: account.address,
            storedState,
            wagmiConfig,
          }
          : null,
      }}
    >
      {children}
    </TransactionFlowContext.Provider>
  );
}

function useSteps(
  flow: Flowstate<FlowRequestMap[keyof FlowRequestMap]> | null,
  enabled: boolean,
) {
  const account = useAccount();
  const storedState = useStoredState();
  const wagmiConfig = useWagmiConfig();

  return useQuery({
    enabled,
    queryKey: [
      "transaction-flow-steps",
      jsonStringifyWithDnum(flow?.request),
      account.address,
    ],
    queryFn: async () => {
      if (!flow || !account.address || flow.account !== account.address) {
        return null;
      }

      const flowDeclaration = getFlowDeclaration(flow?.request.flowId as keyof FlowRequestMap);
      if (!flowDeclaration) {
        throw new Error("Flow declaration not found: " + flow.request.flowId);
      }

      const context = {
        account: account.address,
        contracts: getContracts(),
        request: flow.request,
        steps: flow.steps,
        storedState,
        wagmiConfig,
      };

      return flowDeclaration.getSteps(context);
    },
  });
}

function useFlowManager(account: Address | null) {
  const [flow, setFlow] = useState<Flowstate<FlowRequestMap[keyof FlowRequestMap]> | null>(null);

  useEffect(() => {
    // no account or wrong account => set flow to null (but preserve local storage state)
    if (!account || (flow && flow.account !== account)) {
      setFlow(null);
      return;
    }

    // no flow => attempt to restore from local storage
    if (!flow) {
      const savedFlow = FlowContextStorage.get();
      if (savedFlow?.account === account) {
        setFlow(savedFlow);
      }
    }
  }, [account, flow]);

  const startFlow = useCallback((
    request: FlowRequestMap[keyof FlowRequestMap],
    account: Address,
  ) => {
    const newFlow = { account, request, steps: null };
    setFlow(newFlow);
    FlowContextStorage.set(newFlow);
  }, []);

  const discardFlow = useCallback(() => {
    setFlow(null);
    FlowContextStorage.clear();
  }, []);

  const setFlowSteps = useCallback((steps: FlowStep[] | null) => {
    if (!flow) return;

    const newFlow = { ...flow, steps };
    setFlow(newFlow);
    FlowContextStorage.set(newFlow);
  }, [flow]);

  const updateFlowStep = useCallback((
    stepIndex: number,
    update: Omit<FlowStep, "id">,
  ) => {
    if (!flow?.steps) return;

    const newSteps = flow.steps.map((step, i) => (
      i === stepIndex ? { ...step, ...update } : step
    ));

    setFlowSteps(newSteps);
  }, [flow, setFlowSteps]);

  const currentStepIndex = useMemo(() => {
    const firstUnconfirmed = flow?.steps?.findIndex(
      (step) => step.status !== "confirmed",
    ) ?? -1;
    return firstUnconfirmed === -1 ? (flow?.steps?.length ?? 0) - 1 : firstUnconfirmed;
  }, [flow]);

  const currentStep = useMemo(
    () => flow?.steps?.[currentStepIndex] ?? null,
    [flow, currentStepIndex],
  );

  const flowDeclaration = useMemo(() => (
    flow && (flow.request.flowId in flows)
      ? getFlowDeclaration(flow.request.flowId as keyof FlowRequestMap)
      : null
  ), [flow]);

  const isFlowComplete = useMemo(
    () => flow?.steps?.at(-1)?.status === "confirmed",
    [flow],
  );

  // get steps when the flow starts
  const awaitingSteps = flow !== null && flow.steps === null;
  const steps = useSteps(
    flow,
    Boolean(awaitingSteps && account && flow.account === account),
  );
  if (awaitingSteps && steps.data) {
    setFlowSteps(steps.data.map((id) => ({
      id,
      status: "idle",
      artifact: null,
      error: null,
    })));
  }

  useResetQueriesOnPathChange(isFlowComplete);

  return {
    currentStep,
    currentStepIndex,
    discardFlow,
    flow,
    flowDeclaration,
    isFlowComplete,
    startFlow,
    updateFlowStep,
  };
}

const FlowContextStorage = {
  set(flow: Flowstate<FlowRequestMap[keyof FlowRequestMap]>) {
    localStorage.setItem(TRANSACTION_FLOW_KEY, jsonStringifyWithDnum(flow));
  },
  get(): Flowstate<FlowRequestMap[keyof FlowRequestMap]> | null {
    try {
      const storedFlowState = (localStorage.getItem(TRANSACTION_FLOW_KEY) ?? "").trim();
      if (!storedFlowState) {
        return null;
      }

      // parse the base flow structure
      const flow = v.parse(FlowStateSchema, jsonParseWithDnum(storedFlowState));

      const flowDeclaration = getFlowDeclaration(flow.request.flowId);
      if (!flowDeclaration) {
        throw new Error(`Unknown flow ID: ${flow.request.flowId}`);
      }

      // parse the current flow request
      const request = flowDeclaration.parseRequest(flow.request);
      if (!request) {
        throw new Error(`Invalid request for flow ${flow.request.flowId}`);
      }

      // remove awaiting-commit status from steps so users
      // can refresh & retry without getting stuck
      const steps = flow.steps?.map((step) => (
        step.status === "awaiting-commit"
          ? { ...step, status: "idle" as const }
          : step
      )) ?? null;

      return { ...flow, steps, request };
    } catch (err) {
      console.error(err);
      localStorage.removeItem(TRANSACTION_FLOW_KEY);
      return null;
    }
  },
  clear() {
    localStorage.removeItem(TRANSACTION_FLOW_KEY);
  },
};

export function useTransactionFlow() {
  return useContext(TransactionFlowContext);
}

function useResetQueriesOnPathChange(condition: boolean) {
  const invalidateOnPathChange = useRef(false);
  const pathName = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    // when the condition changes, set a flag to invalidate
    if (pathName === "/transactions" && condition) {
      invalidateOnPathChange.current = true;
      return;
    }
    // when the path changes, invalidate if the flag is set
    if (pathName !== "/transactions" && invalidateOnPathChange.current) {
      queryClient.resetQueries();
      invalidateOnPathChange.current = false;
      return;
    }
  }, [condition, pathName, queryClient]);
}
