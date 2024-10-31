"use client";

// The TransactionFlow component represents a series of one transactions
// executed in sequence. It only stores the last series of transactions.
//
// Naming conventions:
// - Request: The initial request parameters that starts a flow.
// - Flow: A series of transactions that are executed in sequence.
// - Flow steps: Series of transactions in a flow (determined by the request).
// - Flow declaration: Contains the logic for a specific flow (get steps, parse request, tx params).
// - Flow context: a transaction flow as stored in local storage (steps + request).

import type { Contracts } from "@/src/contracts";
import type { Request as CloseLoanPositionRequest } from "@/src/tx-flows/closeLoanPosition";
import type { Request as EarnClaimRewardsRequest } from "@/src/tx-flows/earnClaimRewards";
import type { Request as EarnDepositRequest } from "@/src/tx-flows/earnDeposit";
import type { Request as EarnWithdrawRequest } from "@/src/tx-flows/earnWithdraw";
import type { Request as OpenBorrowPositionRequest } from "@/src/tx-flows/openBorrowPosition";
import type { Request as OpenLeveragePositionRequest } from "@/src/tx-flows/openLeveragePosition";
import type { Request as StakeClaimRewardsRequest } from "@/src/tx-flows/stakeClaimRewards";
import type { Request as StakeDepositRequest } from "@/src/tx-flows/stakeDeposit";
import type { Request as UnstakeDepositRequest } from "@/src/tx-flows/unstakeDeposit";
import type { Request as UpdateBorrowPositionRequest } from "@/src/tx-flows/updateBorrowPosition";
import type { Request as UpdateLeveragePositionRequest } from "@/src/tx-flows/updateLeveragePosition";
import type { Request as UpdateLoanInterestRateRequest } from "@/src/tx-flows/updateLoanInterestRate";
import type { Address } from "@/src/types";
import type { GetTransactionReceiptReturnType, WriteContractParameters } from "@wagmi/core";
import type { ComponentType, ReactNode } from "react";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { getContracts } from "@/src/contracts";
import { jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useAccount, useWagmiConfig } from "@/src/services/Ethereum";
import { closeLoanPosition } from "@/src/tx-flows/closeLoanPosition";
import { earnClaimRewards } from "@/src/tx-flows/earnClaimRewards";
import { earnDeposit } from "@/src/tx-flows/earnDeposit";
import { earnWithdraw } from "@/src/tx-flows/earnWithdraw";
import { openBorrowPosition } from "@/src/tx-flows/openBorrowPosition";
import { openLeveragePosition } from "@/src/tx-flows/openLeveragePosition";
import { stakeClaimRewards } from "@/src/tx-flows/stakeClaimRewards";
import { stakeDeposit } from "@/src/tx-flows/stakeDeposit";
import { unstakeDeposit } from "@/src/tx-flows/unstakeDeposit";
import { updateBorrowPosition } from "@/src/tx-flows/updateBorrowPosition";
import { updateLeveragePosition } from "@/src/tx-flows/updateLeveragePosition";
import { updateLoanInterestRate } from "@/src/tx-flows/updateLoanInterestRate";
import { noop } from "@/src/utils";
import { vAddress, vHash } from "@/src/valibot-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as v from "valibot";
import { useTransactionReceipt, useWriteContract } from "wagmi";

const TRANSACTION_FLOW_KEY = `${LOCAL_STORAGE_PREFIX}transaction_flow`;

export type FlowRequest =
  | CloseLoanPositionRequest
  | EarnClaimRewardsRequest
  | EarnDepositRequest
  | EarnWithdrawRequest
  | OpenBorrowPositionRequest
  | OpenLeveragePositionRequest
  | StakeClaimRewardsRequest
  | StakeDepositRequest
  | UnstakeDepositRequest
  | UpdateBorrowPositionRequest
  | UpdateLeveragePositionRequest
  | UpdateLoanInterestRateRequest;

const flowDeclarations: {
  [K in FlowIdFromFlowRequest<FlowRequest>]: FlowDeclaration<
    Extract<FlowRequest, { flowId: K }>,
    any // Use 'any' here to allow any StepId type
  >;
} = {
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

const FlowIdSchema = v.union([
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

type ExtractStepId<T> = T extends FlowDeclaration<any, infer S> ? S : never;

type FlowDeclarations = {
  [K in FlowIdFromFlowRequest<FlowRequest>]: FlowDeclaration<
    Extract<FlowRequest, { flowId: K }>,
    ExtractStepId<typeof flowDeclarations[K]>
  >;
};

export type FlowId = keyof FlowDeclarations;

function getFlowDeclaration<
  T extends FlowIdFromFlowRequest<FlowRequest>,
>(flowId: T): FlowDeclaration<
  Extract<FlowRequest, { flowId: T }>,
  ExtractStepId<typeof flowDeclarations[T]>
> {
  return flowDeclarations[flowId];
}

export type FlowIdFromFlowRequest<FR extends FlowRequest> = FR["flowId"];
export type FlowRequestFromFlowId<FI extends FlowId> = Extract<FlowRequest, { flowId: FI }>;
export type FlowContextFromFlowId<FI extends FlowId> = FlowContext<FlowRequestFromFlowId<FI>>;

export const FlowStepsSchema = v.union([
  v.null(),
  v.array(
    v.union([
      v.object({
        id: v.string(),
        error: v.string(),
        txHash: v.union([v.null(), vHash()]),
        txReceiptData: v.null(),
        txStatus: v.literal("error"),
      }),
      v.object({
        id: v.string(),
        error: v.null(),
        txHash: v.union([v.null(), vHash()]),
        txReceiptData: v.null(),
        txStatus: v.union([
          v.literal("idle"),
          v.literal("awaiting-signature"),
          v.literal("awaiting-confirmation"),
        ]),
      }),
      v.object({
        id: v.string(),
        error: v.null(),
        txHash: vHash(),
        txReceiptData: v.union([v.null(), v.string()]),
        txStatus: v.literal("confirmed"),
      }),
    ]),
  ),
]);

type FlowStepUpdate =
  | {
    error: string;
    txHash: null | `0x${string}`;
    txStatus: "error";
    txReceiptData: null;
  }
  | {
    error: null;
    txHash: null | `0x${string}`;
    txStatus: "idle" | "awaiting-signature" | "awaiting-confirmation";
    txReceiptData: null;
  }
  | {
    error: null;
    txHash: `0x${string}`;
    txStatus: "confirmed";
    txReceiptData: null | string;
  };

export type FlowSteps = NonNullable<
  v.InferOutput<typeof FlowStepsSchema>
>;

export type FlowStepStatus = FlowSteps[number]["txStatus"];

// The context of a transaction flow, as stored in local storage
export type FlowContext<FR extends FlowRequest> = {
  account: Address | null;
  request: FR;
  steps: FlowSteps | null;
};

const FlowStateSchema = v.object({
  account: vAddress(),
  request: v.looseObject({
    flowId: FlowIdSchema,
    backLink: v.union([
      v.null(),
      v.tuple([
        v.string(), // path
        v.string(), // label
      ]),
    ]),
    successLink: v.tuple([
      v.string(), // path
      v.string(), // label
    ]),
  }),
  steps: FlowStepsSchema,
});

type FlowArgs<FR extends FlowRequest> = {
  account: ReturnType<typeof useAccount>;
  contracts: Contracts;
  request: FR;
  steps: FlowSteps | null;
  wagmiConfig: ReturnType<typeof useWagmiConfig>;
};

type GetStepsFn<FR extends FlowRequest, StepId extends string> = (args: FlowArgs<FR>) => Promise<StepId[]>;

type WriteContractParamsFn<FR extends FlowRequest, StepId extends string> = (
  stepId: StepId,
  args: FlowArgs<FR>,
) => Promise<null | WriteContractParameters>;

export type FlowDeclaration<
  FR extends FlowRequest,
  StepId extends string = string,
> = {
  title: ReactNode;
  Summary: ComponentType<{ flow: FlowContext<FR> }>;
  Details: ComponentType<{ flow: FlowContext<FR> }>;
  getSteps: GetStepsFn<FR, StepId>;
  getStepName: (stepId: StepId, args: {
    contracts: Contracts;
    request: FR;
  }) => string;
  parseRequest: (request: unknown) => FR | null;
  parseReceipt?: (
    stepId: StepId,
    receipt: GetTransactionReceiptReturnType,
    args: {
      contracts: Contracts;
      request: FR;
    },
  ) => null | string;
  writeContractParams: WriteContractParamsFn<FR, StepId>;
};

type Context<FR extends FlowRequest = FlowRequest> = {
  contracts: null | Contracts;
  currentStepIndex: number;
  discard: () => void;
  signAndSend: () => Promise<void>;
  start: (request: FR) => void;
  flow: null | FlowContext<FR>;
  flowDeclaration: null | FlowDeclaration<FR, ExtractStepId<typeof flowDeclarations[FR["flowId"]]>>;
};

const TransactionFlowContext = createContext<Context>({
  contracts: null,
  currentStepIndex: -1,
  discard: noop,
  signAndSend: async () => {},
  start: noop,
  flow: null,
  flowDeclaration: null,
});

export function TransactionFlow({ children }: { children: ReactNode }) {
  const router = useRouter();
  const wagmiConfig = useWagmiConfig();
  const account = useAccount();
  const contracts = getContracts();

  const [{ flow }, setFlowAndStatus] = useState<{
    flow: null | FlowContext<FlowRequest>;
  }>({
    flow: null,
  });

  const currentStepIndex = getCurrentStepIndex(flow);

  const declaration = flow?.request.flowId ? getFlowDeclaration(flow.request.flowId) : null;

  // initiate a new transaction flow (triggers fetching the steps)
  const start: Context["start"] = useCallback((request) => {
    if (!account.address) {
      return;
    }

    const newFlow = {
      account: account.address,
      request,
      steps: null,
    };

    setFlowAndStatus({ flow: newFlow });
    FlowContextStorage.set(newFlow);

    router.push("/transactions");
  }, [account]);

  // discard the current transaction flow (remove it from local storage)
  const discard: Context["discard"] = useCallback(() => {
    setFlowAndStatus({ flow: null });
    FlowContextStorage.clear();
  }, []);

  // update a specific step in the flow
  const updateStep = (index: number, update: FlowStepUpdate) => {
    if (!flow) {
      return;
    }

    const newFlow = {
      ...flow,
      steps: flow.steps?.map((step, index_) => (
        index_ === index ? { ...step, ...update } : step
      )) ?? null,
    };

    // update state + local storage
    setFlowAndStatus({ flow: newFlow });
    FlowContextStorage.set(newFlow);
  };

  useSteps({
    flow,
    enabled: Boolean(
      flow
        && account.address
        && flow.account === account.address
        && flow.steps === null,
    ),
    account,
    contracts,
    wagmiConfig,
    onSteps: (steps) => {
      if (!flow) {
        return;
      }

      const newFlow = {
        ...flow,
        steps: steps.map((id) => ({
          id,
          error: null,
          txHash: null,
          txReceiptData: null,
          txStatus: "idle" as const,
        })),
      };

      setFlowAndStatus({ flow: newFlow });
      FlowContextStorage.set(newFlow);
    },
  });

  // update the active flow when the account changes
  useEffect(() => {
    // no account: no active flow
    if (!account.address) {
      if (flow) {
        setFlowAndStatus({ flow: null });
      }
      return;
    }

    // no flow: try to restore from local storage
    if (!flow) {
      const flow = FlowContextStorage.get() ?? null;
      if (flow?.account === account.address) {
        setFlowAndStatus({ flow });
      }
      return;
    }

    // flow exists, but different account: no active flow
    if (account.address !== flow.account) {
      setFlowAndStatus({ flow: null });
    }
  }, [account, flow]);

  const contractWrite = useWriteContract({
    mutation: {
      onError: (err) => {
        updateStep(currentStepIndex, {
          error: `${err.name}: ${err.message}`,
          txHash: null,
          txReceiptData: null,
          txStatus: "error",
        });
      },
      onSuccess: (txHash) => {
        updateStep(currentStepIndex, {
          error: null,
          txHash,
          txReceiptData: null,
          txStatus: "awaiting-confirmation",
        });
      },
      onMutate: () => {
        updateStep(currentStepIndex, {
          error: null,
          txHash: null,
          txReceiptData: null,
          txStatus: "awaiting-signature",
        });
      },
    },
  });

  const currentStep = flow?.steps?.[currentStepIndex];

  const txReceipt = useTransactionReceipt({
    hash: contractWrite.data ?? (
      (currentStep?.txStatus === "awaiting-confirmation" && currentStep.txHash) || undefined
    ),
    query: {
      retry: true,
    },
  });

  const flowDeclaration = flow && getFlowDeclaration(flow.request.flowId);

  const signAndSend = useCallback(async () => {
    const currentStepId = flow?.steps?.[currentStepIndex]?.id;

    if (!currentStepId || currentStepIndex < 0 || !account || !flow || !flowDeclaration) {
      return;
    }

    const params = await flowDeclaration.writeContractParams(currentStepId, {
      account,
      contracts,
      request: flow.request,
      steps: flow.steps,
      wagmiConfig,
    });

    if (params) {
      contractWrite.writeContract(params);
    }
  }, [
    account,
    contractWrite,
    contracts,
    currentStepIndex,
    flow,
    flowDeclaration,
    updateStep,
    wagmiConfig,
  ]);

  const totalSteps = flow?.steps?.length ?? 0;

  const queryClient = useQueryClient();

  // handle transaction receipt
  useEffect(() => {
    if (txReceipt.status !== "pending") {
      contractWrite.reset();
    }
    if (txReceipt.status === "error") {
      updateStep(currentStepIndex, {
        error: txReceipt.error.message,
        txHash: null,
        txReceiptData: null,
        txStatus: "error",
      });
      return;
    }
    if (txReceipt.data?.status === "reverted") {
      updateStep(currentStepIndex, {
        error: "Transaction reverted.",
        txHash: txReceipt.data.transactionHash,
        txReceiptData: null,
        txStatus: "error",
      });
      return;
    }
    if (txReceipt.status === "success" && flow?.request) {
      updateStep(currentStepIndex, {
        error: null,
        txHash: txReceipt.data.transactionHash,
        txReceiptData: declaration?.parseReceipt?.(
          flow?.steps?.[currentStepIndex]?.id ?? "",
          txReceipt.data,
          { contracts, request: flow.request },
        ) ?? null,
        txStatus: "confirmed",
      });
      queryClient.invalidateQueries();
      return;
    }
  }, [
    contractWrite,
    currentStepIndex,
    declaration,
    queryClient,
    totalSteps,
    txReceipt,
    updateStep,
  ]);

  return (
    <TransactionFlowContext.Provider
      value={{
        contracts,
        currentStepIndex,
        discard,
        start,
        flow,
        flowDeclaration,
        signAndSend,
      }}
    >
      {children}
    </TransactionFlowContext.Provider>
  );
}

function useSteps<FR extends FlowRequest>({
  flow,
  enabled,
  account,
  contracts,
  wagmiConfig,
  onSteps,
}: {
  flow: FlowContext<FR> | null;
  enabled: boolean;
  account: ReturnType<typeof useAccount>;
  contracts: Contracts;
  wagmiConfig: ReturnType<typeof useWagmiConfig>;
  onSteps: (steps: string[]) => void;
}) {
  const steps = useQuery({
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

      const flowDeclaration = getFlowDeclaration(flow.request.flowId);
      return flowDeclaration.getSteps({
        account,
        contracts,
        request: flow.request,
        steps: flow.steps,
        wagmiConfig,
      });
    },
  });

  useEffect(() => {
    if (!flow || !steps.data) {
      return;
    }

    const newSteps = steps.data.map((id) => ({
      id,
      error: null,
      txHash: null,
    }));

    const stepsKey = flow.steps?.map((s) => s.id).join("");
    const newStepsKey = newSteps.map((s) => s.id).join("");

    if (stepsKey !== newStepsKey) {
      onSteps(steps.data);
    }
  }, [steps.data, flow, onSteps]);
}

export function useTransactionFlow() {
  return useContext(TransactionFlowContext);
}

function getCurrentStepIndex(flow: FlowContext<FlowRequest> | null) {
  if (!flow?.steps) return 0;
  const index = flow.steps.findIndex((step) => step.txStatus !== "confirmed");
  return index === -1 ? flow.steps.length - 1 : index;
}

const FlowContextStorage = {
  set(flow: FlowContext<FlowRequest>) {
    localStorage.setItem(TRANSACTION_FLOW_KEY, jsonStringifyWithDnum(flow));
  },
  get(): FlowContext<FlowRequest> | null {
    try {
      const storedState = localStorage.getItem(TRANSACTION_FLOW_KEY) ?? "";
      const { request, steps, account } = v.parse(FlowStateSchema, jsonParseWithDnum(storedState));
      const declaration = getFlowDeclaration(request.flowId);
      const parsedRequest = declaration.parseRequest(request);
      const parsedSteps = v.parse(FlowStepsSchema, steps);
      if (account && parsedRequest && parsedSteps) {
        return {
          account,
          request: parsedRequest,
          steps: parsedSteps,
        };
      }
      // eslint-disable-next-line no-unused-vars
    } catch (_) {}
    return null;
  },
  clear() {
    localStorage.removeItem(TRANSACTION_FLOW_KEY);
  },
};
