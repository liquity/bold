"use client";

import type { Contracts } from "@/src/contracts";
import type { Address } from "@/src/types";
import type { ComponentType, ReactNode } from "react";
import type { Abi, ContractFunctionArgs, ContractFunctionName, ReadContractReturnType } from "viem";
import type { Config as WagmiConfig } from "wagmi";
import type { ReadContractOptions } from "wagmi/query";

import { GAS_MIN_HEADROOM, GAS_RELATIVE_HEADROOM, LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { CONTRACTS } from "@/src/contracts";
import { jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useStoredState } from "@/src/services/StoredState";
import { noop } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { useAccount } from "@/src/wagmi-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { encodeFunctionData } from "viem";
import { useConfig as useWagmiConfig } from "wagmi";
import { estimateGas, readContract, writeContract } from "wagmi/actions";

/* flows registration */

import { allocateVotingPower, type AllocateVotingPowerRequest } from "@/src/tx-flows/allocateVotingPower";
import { claimBribes, type ClaimBribesRequest } from "@/src/tx-flows/claimBribes";
import { claimCollateralSurplus, type ClaimCollateralSurplusRequest } from "@/src/tx-flows/claimCollateralSurplus";
import { closeLoanPosition, type CloseLoanPositionRequest } from "@/src/tx-flows/closeLoanPosition";
import { earnClaimRewards, type EarnClaimRewardsRequest } from "@/src/tx-flows/earnClaimRewards";
import { earnUpdate, type EarnUpdateRequest } from "@/src/tx-flows/earnUpdate";
import { legacyCloseLoanPosition, type LegacyCloseLoanPositionRequest } from "@/src/tx-flows/legacyCloseLoanPosition";
import { legacyEarnWithdrawAll, type LegacyEarnWithdrawAllRequest } from "@/src/tx-flows/legacyEarnWithdrawAll";
import { legacyRedeemCollateral, type LegacyRedeemCollateralRequest } from "@/src/tx-flows/legacyRedeemCollateral";
import { legacyUnstakeAll, type LegacyUnstakeAllRequest } from "@/src/tx-flows/legacyUnstakeAll";
import { openBorrowPosition, type OpenBorrowPositionRequest } from "@/src/tx-flows/openBorrowPosition";
import { openLeveragePosition, type OpenLeveragePositionRequest } from "@/src/tx-flows/openLeveragePosition";
import { redeemCollateral, type RedeemCollateralRequest } from "@/src/tx-flows/redeemCollateral";
import { sboldDeposit, type SboldDepositRequest } from "@/src/tx-flows/sboldDeposit";
import { sboldRedeem, type SboldRedeemRequest } from "@/src/tx-flows/sboldRedeem";
import { stakeClaimRewards, type StakeClaimRewardsRequest } from "@/src/tx-flows/stakeClaimRewards";
import { stakeDeposit, type StakeDepositRequest } from "@/src/tx-flows/stakeDeposit";
import { unstakeDeposit, type UnstakeDepositRequest } from "@/src/tx-flows/unstakeDeposit";
import { updateBorrowPosition, type UpdateBorrowPositionRequest } from "@/src/tx-flows/updateBorrowPosition";
import { updateLeveragePosition, type UpdateLeveragePositionRequest } from "@/src/tx-flows/updateLeveragePosition";
import { updateLoanInterestRate, type UpdateLoanInterestRateRequest } from "@/src/tx-flows/updateLoanInterestRate";

export type FlowRequestMap = {
  "allocateVotingPower": AllocateVotingPowerRequest;
  "claimBribes": ClaimBribesRequest;
  "claimCollateralSurplus": ClaimCollateralSurplusRequest;
  "closeLoanPosition": CloseLoanPositionRequest;
  "earnClaimRewards": EarnClaimRewardsRequest;
  "earnUpdate": EarnUpdateRequest;
  "legacyCloseLoanPosition": LegacyCloseLoanPositionRequest;
  "legacyEarnWithdrawAll": LegacyEarnWithdrawAllRequest;
  "legacyRedeemCollateral": LegacyRedeemCollateralRequest;
  "legacyUnstakeAll": LegacyUnstakeAllRequest;
  "openBorrowPosition": OpenBorrowPositionRequest;
  "openLeveragePosition": OpenLeveragePositionRequest;
  "redeemCollateral": RedeemCollateralRequest;
  "sboldDeposit": SboldDepositRequest;
  "sboldRedeem": SboldRedeemRequest;
  "stakeClaimRewards": StakeClaimRewardsRequest;
  "stakeDeposit": StakeDepositRequest;
  "unstakeDeposit": UnstakeDepositRequest;
  "updateBorrowPosition": UpdateBorrowPositionRequest;
  "updateLeveragePosition": UpdateLeveragePositionRequest;
  "updateLoanInterestRate": UpdateLoanInterestRateRequest;
};

const FlowIdSchema = v.union([
  v.literal("allocateVotingPower"),
  v.literal("claimBribes"),
  v.literal("claimCollateralSurplus"),
  v.literal("closeLoanPosition"),
  v.literal("earnClaimRewards"),
  v.literal("earnUpdate"),
  v.literal("legacyCloseLoanPosition"),
  v.literal("legacyEarnWithdrawAll"),
  v.literal("legacyRedeemCollateral"),
  v.literal("legacyUnstakeAll"),
  v.literal("openBorrowPosition"),
  v.literal("openLeveragePosition"),
  v.literal("redeemCollateral"),
  v.literal("sboldDeposit"),
  v.literal("sboldRedeem"),
  v.literal("stakeClaimRewards"),
  v.literal("stakeDeposit"),
  v.literal("unstakeDeposit"),
  v.literal("updateBorrowPosition"),
  v.literal("updateLeveragePosition"),
  v.literal("updateLoanInterestRate"),
]);

export const flows: FlowsMap = {
  allocateVotingPower,
  claimBribes,
  claimCollateralSurplus,
  closeLoanPosition,
  earnClaimRewards,
  earnUpdate,
  legacyCloseLoanPosition,
  legacyEarnWithdrawAll,
  legacyRedeemCollateral,
  legacyUnstakeAll,
  openBorrowPosition,
  openLeveragePosition,
  redeemCollateral,
  sboldDeposit,
  sboldRedeem,
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
  error: { name: string | null; message: string } | null;
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
    | { status: "idle" }
    | { status: "awaiting-commit"; onRetry: () => void }
    | { status: "awaiting-verify" | "confirmed"; artifact: string }
    | {
      status: "error";
      error: { name: string | null; message: string };
      artifact?: string;
    }
  >;
};

export type FlowDeclaration<FlowRequest extends BaseFlowRequest> = {
  title: ReactNode;
  Summary:
    | null
    | ComponentType<{
      account: Address;
      request: FlowRequest;
      steps: FlowStep[] | null;
    }>;
  Details: ComponentType<{
    account: Address;
    request: FlowRequest;
    steps: FlowStep[] | null;
  }>;
  steps: Record<string, FlowStepDeclaration<FlowRequest>>;
  getSteps: (params: FlowParams<FlowRequest>) => Promise<string[]>;
  parseRequest: (request: unknown) => FlowRequest | null;
};

// passed to the react context + saved in local storage
export type Flowstate<FlowRequest extends BaseFlowRequest = BaseFlowRequest> = {
  account: Address;
  request: FlowRequest;
  steps: FlowStep[] | null;
};

// passed to the step functions
export type FlowParams<FlowRequest extends BaseFlowRequest = BaseFlowRequest> = {
  account: Address;
  contracts: Contracts;
  isSafe: boolean;
  preferredApproveMethod: "permit" | "approve-amount" | "approve-infinite";
  readContract: ReturnType<typeof getReadContract>;
  request: FlowRequest;
  steps: FlowStep[] | null;
  storedState: ReturnType<typeof useStoredState>;
  wagmiConfig: WagmiConfig;
  writeContract: ReturnType<typeof getWriteContract>;
};

function getReadContract(config: WagmiConfig) {
  return <
    const A extends Abi,
    const F extends ContractFunctionName<A, "pure" | "view">,
    const Args extends ContractFunctionArgs<A, "pure" | "view", F>,
  >(options: ReadContractOptions<A, F, Args, WagmiConfig>) => {
    return readContract(config, options as any) as Promise<
      ReadContractReturnType<A, F, Args>
    >;
  };
}

function getWriteContract(config: WagmiConfig, account: Address) {
  return async (
    params: Omit<Parameters<typeof writeContract>[1], "value"> & {
      value?: bigint;
    },
    gasMinHeadroom: number = GAS_MIN_HEADROOM,
  ) => {
    const gasEstimate = Number(
      await estimateGas(config, {
        account,
        data: encodeFunctionData({
          abi: params.abi,
          functionName: params.functionName,
          args: params.args,
        }),
        to: params.address,
        value: params.value,
      }),
    );
    const gas = BigInt(
      Math.ceil(gasEstimate + Math.max(gasMinHeadroom, gasEstimate * GAS_RELATIVE_HEADROOM)),
    );

    return writeContract(config, { ...params, gas } as any);
  };
}

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
    v.array(
      v.object({
        id: v.string(),
        status: v.union([
          v.literal("idle"),
          v.literal("awaiting-commit"),
          v.literal("awaiting-verify"),
          v.literal("confirmed"),
          v.literal("error"),
        ]),
        artifact: v.union([v.string(), v.null()]),
        error: v.union([
          v.null(),
          v.object({
            name: v.union([v.string(), v.null()]),
            message: v.string(),
          }),
        ]),
      }),
    ),
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
  clearError: () => void;
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
  clearError: noop,
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
    clearError,
    commit,
    currentStep,
    currentStepIndex,
    discardFlow,
    flow,
    flowDeclaration,
    startFlow,
  } = useFlowManager(account.address ?? null, account.safeStatus !== null);

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
        clearError,
        commit,
        currentStep,
        currentStepIndex,
        discard: discardFlow,
        flow,
        flowDeclaration,
        flowParams: flow && account.address
          ? {
            ...flow,
            account: account.address,
            contracts: CONTRACTS,
            isSafe: account.safeStatus !== null,
            preferredApproveMethod: storedState.preferredApproveMethod,
            readContract: getReadContract(wagmiConfig),
            storedState,
            wagmiConfig,
            writeContract: getWriteContract(wagmiConfig, account.address),
          }
          : null,
        start,
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

      const flowDeclaration = getFlowDeclaration(flow?.request.flowId);
      if (!flowDeclaration) {
        throw new Error("Flow declaration not found: " + flow.request.flowId);
      }

      return flowDeclaration.getSteps({
        account: account.address,
        contracts: CONTRACTS,
        isSafe: account.safeStatus !== null,
        preferredApproveMethod: storedState.preferredApproveMethod,
        readContract: getReadContract(wagmiConfig),
        request: flow.request,
        steps: flow.steps,
        storedState,
        wagmiConfig,
        writeContract: getWriteContract(wagmiConfig, account.address),
      });
    },
  });
}

function useFlowManager(account: Address | null, isSafe: boolean = false) {
  const [flow, setFlow] = useState<Flowstate<FlowRequestMap[keyof FlowRequestMap]> | null>(null);
  const wagmiConfig = useWagmiConfig();
  const storedState = useStoredState();
  const runningStepRef = useRef<string | null>(null);

  useEffect(() => {
    if (!account || (flow && flow.account !== account)) {
      setFlow(null);
      return;
    }

    if (!flow) {
      const savedFlow = FlowContextStorage.get();
      if (savedFlow?.account === account) {
        setFlow(savedFlow);
      }
    }
  }, [account, flow]);

  // start going through the states of a step
  const startStep = useCallback(async (
    stepDef: FlowStepDeclaration<FlowRequestMap[keyof FlowRequestMap]>,
    stepIndex: number,
    currentArtifact: string | null = null,
  ) => {
    if (!flow || !account) return;

    const stepKey = `${stepIndex}-${currentArtifact ?? ""}`;
    if (runningStepRef.current === stepKey) {
      return;
    }

    try {
      runningStepRef.current = stepKey;

      const params: FlowParams<FlowRequestMap[keyof FlowRequestMap]> = {
        readContract: getReadContract(wagmiConfig),
        account,
        contracts: CONTRACTS,
        isSafe,
        preferredApproveMethod: storedState.preferredApproveMethod,
        request: flow.request,
        steps: flow.steps,
        storedState,
        wagmiConfig,
        writeContract: getWriteContract(wagmiConfig, account),
      };

      let artifact = currentArtifact;

      if (!artifact) {
        updateFlowStep(stepIndex, {
          status: "awaiting-commit",
          artifact: null,
          error: null,
        });

        artifact = await stepDef.commit(params);
        if (artifact === null) {
          throw new Error("Commit failed - no artifact returned");
        }
      }

      updateFlowStep(stepIndex, {
        status: "awaiting-verify",
        artifact,
        error: null,
      });

      await stepDef.verify(params, artifact);

      updateFlowStep(stepIndex, {
        status: "confirmed",
        artifact,
        error: null,
      });
    } catch (error) {
      updateFlowStep(stepIndex, {
        status: "error",
        artifact: currentArtifact,
        error: error instanceof Error
          ? {
            name: error.name.toLowerCase().trim() === "error" ? null : error.name,
            message: error.message,
          }
          : { name: null, message: String(error) },
      });
      console.error(`Error at step ${stepIndex}:`, error);
    } finally {
      runningStepRef.current = null;
    }
  }, [account, flow, storedState, wagmiConfig]);

  // resume verification of the current step if needed
  useEffect(() => {
    if (!flow?.steps || !account) return;

    const verifyingStep = flow.steps.find((step) => step.status === "awaiting-verify" && step.artifact);
    if (!verifyingStep) return;

    // if runningStepRef is set, no need to resume
    if (runningStepRef.current !== null) {
      return;
    }

    const stepIndex = flow.steps.indexOf(verifyingStep);
    const flowDeclaration = getFlowDeclaration(flow.request.flowId);
    if (!flowDeclaration) return;

    const stepDef = flowDeclaration.steps[verifyingStep.id];
    if (!stepDef) return;

    startStep(stepDef, stepIndex, verifyingStep.artifact);
  }, [flow, account, startStep]);

  const discardFlow = useCallback(() => {
    setFlow(null);
    FlowContextStorage.clear();
    runningStepRef.current = null;
  }, [setFlow]);

  const startFlow = useCallback((
    request: FlowRequestMap[keyof FlowRequestMap],
    account: Address,
  ) => {
    discardFlow(); // discard any current flow before starting a new one
    const newFlow = { account, request, steps: null };
    setFlow(newFlow);
    FlowContextStorage.set(newFlow);
  }, [discardFlow, setFlow]);

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
      ? getFlowDeclaration(flow.request.flowId)
      : null
  ), [flow]);

  const commit = useCallback(async () => {
    if (!flow || !flowDeclaration || !currentStep || currentStepIndex === -1) {
      return;
    }

    const stepDef = flowDeclaration.steps[currentStep.id];
    if (!stepDef) return;

    await startStep(stepDef, currentStepIndex);
  }, [flow, flowDeclaration, currentStep, currentStepIndex, startStep]);

  const clearError = useCallback(() => {
    if (!flow?.steps || currentStepIndex === -1) return;
    if (flow.steps[currentStepIndex]?.status === "error") {
      updateFlowStep(currentStepIndex, {
        status: "idle",
        artifact: null,
        error: null,
      });
    }
  }, [flow, currentStepIndex, updateFlowStep]);

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

  useEffect(() => {
    if (awaitingSteps && steps.data) {
      setFlowSteps(steps.data.map((id) => ({
        id,
        status: "idle",
        artifact: null,
        error: null,
      })));
    }
  }, [awaitingSteps, steps.data, setFlowSteps]);

  useResetQueriesOnPathChange(isFlowComplete);

  return {
    clearError,
    currentStep,
    currentStepIndex,
    discardFlow,
    flow,
    flowDeclaration,
    isFlowComplete,
    startFlow,
    commit,
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

      return { ...flow, request };
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
