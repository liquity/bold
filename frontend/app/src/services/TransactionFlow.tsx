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
import type { Request as EarnDepositRequest } from "@/src/tx-flows/earnDeposit";
import type { Request as EarnWithdrawRequest } from "@/src/tx-flows/earnWithdraw";
import type { Request as OpenLoanPositionRequest } from "@/src/tx-flows/openLoanPosition";
import type { Request as UpdateLoanInterestRateRequest } from "@/src/tx-flows/updateLoanInterestRate";
import type { Request as UpdateLoanPositionRequest } from "@/src/tx-flows/updateLoanPosition";
import type { Address } from "@/src/types";
import type { WriteContractParameters } from "@wagmi/core";
import type { ComponentType, ReactNode } from "react";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { useContracts } from "@/src/contracts";
import { jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useAccount, useWagmiConfig } from "@/src/services/Ethereum";
import { closeLoanPosition } from "@/src/tx-flows/closeLoanPosition";
import { earnDeposit } from "@/src/tx-flows/earnDeposit";
import { earnWithdraw } from "@/src/tx-flows/earnWithdraw";
import { openLoanPosition } from "@/src/tx-flows/openLoanPosition";
import { updateLoanInterestRate } from "@/src/tx-flows/updateLoanInterestRate";
import { updateLoanPosition } from "@/src/tx-flows/updateLoanPosition";
import { noop } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as v from "valibot";
import { useTransactionReceipt, useWriteContract } from "wagmi";

const TRANSACTION_FLOW_KEY = `${LOCAL_STORAGE_PREFIX}transaction_flow`;

export type FlowRequest =
  | CloseLoanPositionRequest
  | EarnDepositRequest
  | EarnWithdrawRequest
  | OpenLoanPositionRequest
  | UpdateLoanInterestRateRequest
  | UpdateLoanPositionRequest;

const flowDeclarations: {
  [K in FlowIdFromFlowRequest<FlowRequest>]: FlowDeclaration<
    Extract<FlowRequest, { flowId: K }>,
    any // Use 'any' here to allow any StepId type
  >;
} = {
  closeLoanPosition,
  earnDeposit,
  earnWithdraw,
  openLoanPosition,
  updateLoanInterestRate,
  updateLoanPosition,
};

const FlowIdSchema = v.union([
  v.literal("closeLoanPosition"),
  v.literal("earnDeposit"),
  v.literal("earnWithdraw"),
  v.literal("openLoanPosition"),
  v.literal("updateLoanInterestRate"),
  v.literal("updateLoanPosition"),
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
        txHash: v.union([v.null(), v.string()]),
        txStatus: v.literal("error"),
      }),
      v.object({
        id: v.string(),
        error: v.null(),
        txHash: v.union([v.null(), v.string()]),
        txStatus: v.union([
          v.literal("idle"),
          v.literal("awaiting-signature"),
          v.literal("awaiting-confirmation"),
          v.literal("confirmed"),
        ]),
      }),
    ]),
  ),
]);

type FlowStepUpdate =
  | { error: string; txHash: null | string; txStatus: "error" }
  | {
    error: null;
    txHash: null | string;
    txStatus: "idle" | "awaiting-signature" | "awaiting-confirmation" | "confirmed";
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
  subtitle: ReactNode;
  Summary: ComponentType<{ flow: FlowContext<FR> }>;
  Details: ComponentType<{ flow: FlowContext<FR> }>;
  getSteps: GetStepsFn<FR, StepId>;
  getStepName: (stepId: StepId, args: {
    contracts: Contracts;
    request: FR;
  }) => string;
  parseRequest: (request: unknown) => FR | null;
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
  const wagmiConfig = useWagmiConfig();
  const account = useAccount();
  const contracts = useContracts();

  const [{ flow }, setFlowAndStatus] = useState<{
    flow: null | FlowContext<FlowRequest>;
  }>({
    flow: null,
  });

  const currentStepIndex = getCurrentStepIndex(flow);

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

  const contractWrite = useWriteContract();
  const txReceipt = useTransactionReceipt({
    hash: contractWrite.data,
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

    updateStep(currentStepIndex, {
      error: null,
      txHash: null,
      txStatus: "awaiting-signature",
    });

    const params = await flowDeclaration.writeContractParams(currentStepId, {
      contracts,
      request: flow.request,
      account,
      wagmiConfig,
    });

    if (params) {
      contractWrite.writeContract(params, {
        onError: (err) => {
          updateStep(currentStepIndex, {
            error: `${err.name}: ${err.message}`,
            txHash: null,
            txStatus: "error",
          });
        },
      });
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

  // handle transaction receipt
  useEffect(() => {
    if (txReceipt.status !== "pending") {
      contractWrite.reset();
    }
    if (txReceipt.status === "success") {
      updateStep(currentStepIndex, {
        error: null,
        txHash: txReceipt.data.transactionHash,
        txStatus: "confirmed",
      });
    }
    if (txReceipt.status === "error") {
      updateStep(currentStepIndex, {
        error: txReceipt.error.message,
        txHash: null,
        txStatus: "error",
      });
    }
  }, [
    contractWrite,
    currentStepIndex,
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
  const index = flow.steps.findIndex((step) => step.txHash === null);
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
    } catch (_) {}
    return null;
  },
  clear() {
    localStorage.removeItem(TRANSACTION_FLOW_KEY);
  },
};
