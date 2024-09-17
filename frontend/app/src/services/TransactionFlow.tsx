"use client";

// The TransactionFlow component represents a series of one transactions
// executed in sequence. It only stores the last series of transactions.
//
// Naming conventions:
// - Request: The initial request parameters that starts a flow.
// - Flow: A series of transactions that are executed in sequence.
// - Flow steps: Series of transactions in a flow (determined by the request).
// - Flow declaration: Contains the logic for a specific flow.
// - Flow context: a transaction flow as stored in local storage (steps + request).

import type { Request as OpenLoanPositionRequest } from "@/src/tx-flows/openLoanPosition.ts";
import type { Request as RepayAndCloseLoanPositionRequest } from "@/src/tx-flows/repayAndCloseLoanPosition.ts";
import type { Request as UpdateLoanPositionRequest } from "@/src/tx-flows/updateLoanPosition.ts";
import type { Address } from "@/src/types";
import type { WriteContractParameters } from "@wagmi/core";
import type { ReactNode } from "react";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { useContracts } from "@/src/contracts";
import { jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useAccount, useWagmiConfig } from "@/src/services/Ethereum";
import { openLoanPosition } from "@/src/tx-flows/openLoanPosition.ts";
import { repayAndCloseLoanPosition } from "@/src/tx-flows/repayAndCloseLoanPosition.ts";
import { updateLoanPosition } from "@/src/tx-flows/updateLoanPosition.ts";
import { noop } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as v from "valibot";
import { useTransactionReceipt, useWriteContract } from "wagmi";

const TRANSACTION_FLOW_KEY = `${LOCAL_STORAGE_PREFIX}transaction_flow`;

export type FlowRequest =
  | OpenLoanPositionRequest
  | RepayAndCloseLoanPositionRequest
  | UpdateLoanPositionRequest;

const flowDeclarations: FlowDeclarations = {
  openLoanPosition,
  repayAndCloseLoanPosition,
  updateLoanPosition,
};

const FlowIdSchema = v.union([
  v.literal("openLoanPosition"),
  v.literal("repayAndCloseLoanPosition"),
  v.literal("updateLoanPosition"),
]);

type FlowDeclarations = {
  [K in FlowIdFromFlowRequest<FlowRequest>]: FlowDeclaration<Extract<FlowRequest, { flowId: K }>>;
};

export type FlowId = keyof FlowDeclarations;

function getFlowDeclaration<T extends FlowIdFromFlowRequest<FlowRequest>>(
  flowId: T,
): FlowDeclaration<Extract<FlowRequest, { flowId: T }>> {
  return flowDeclarations[flowId];
}

export type FlowIdFromFlowRequest<FR extends FlowRequest> = FR["flowId"];
export type FlowRequestFromFlowId<FI extends FlowId> = Extract<FlowRequest, { flowId: FI }>;
export type FlowContextFromFlowId<FI extends FlowId> = FlowContext<FlowRequestFromFlowId<FI>>;

export type FlowSteps = Array<{
  id: string;
  error: string | null;
  txHash: string | null;
}>;

export const FlowStepsSchema = v.union([
  v.null(),
  v.array(v.object({
    id: v.string(),
    error: v.union([v.null(), v.string()]),
    txHash: v.union([v.null(), v.string()]),
  })),
]);

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
  }),
  steps: FlowStepsSchema,
});

type GetStepsFn<FR extends FlowRequest> = (args: {
  account: ReturnType<typeof useAccount>;
  contracts: ReturnType<typeof useContracts>;
  request: FR;
  wagmiConfig: ReturnType<typeof useWagmiConfig>;
}) => Promise<string[]>;

type WriteContractParamsFn<FR extends FlowRequest> = (args: {
  contracts: ReturnType<typeof useContracts>;
  request: FR;
  stepId: string;
}) => Promise<null | WriteContractParameters>;

export type FlowDeclaration<FR extends FlowRequest> = {
  getSteps: GetStepsFn<FR>;
  parseRequest: (request: unknown) => FR | null;
  writeContractParams: WriteContractParamsFn<FR>;
};

type Context<FR extends FlowRequest = FlowRequest> = {
  currentStepIndex: number;
  discard: () => void;
  signAndSend: () => Promise<void>;
  start: (request: FR) => void;
  flow: null | FlowContext<FR>;
  flowStatus:
    | null // no flow
    | "awaiting-steps" // waiting for steps to be fetched (when start() gets called)
    | "ongoing" // flow loaded and ready to be executed
    | "completed"; // flow completed successfully
};

const TransactionFlowContext = createContext<Context>({
  currentStepIndex: -1,
  discard: noop,
  signAndSend: async () => {},
  start: noop,
  flow: null,
  flowStatus: null,
});

export function TransactionFlow({ children }: { children: ReactNode }) {
  const wagmiConfig = useWagmiConfig();
  const account = useAccount();
  const contracts = useContracts();

  const [{ flow, flowStatus }, setFlowAndStatus] = useState<{
    flow: null | FlowContext<FlowRequest>;
    flowStatus: Context["flowStatus"];
  }>({
    flow: null,
    flowStatus: null,
  });

  const currentStepIndex = flow?.steps?.findIndex((step) => step.txHash === null) ?? -1;

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

    setFlowAndStatus({
      flow: newFlow,
      flowStatus: "awaiting-steps",
    });
    FlowContextStorage.set(newFlow);
  }, [account]);

  // discard the current transaction flow (remove it from local storage)
  const discard: Context["discard"] = useCallback(() => {
    setFlowAndStatus({
      flow: null,
      flowStatus: null,
    });
    FlowContextStorage.clear();
  }, []);

  // update a specific step in the flow
  const updateStep = (
    index: number,
    update: {
      error: null | string;
      txHash: null | `0x${string}`;
    },
  ) => {
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
    setFlowAndStatus({
      flow: newFlow,
      flowStatus,
    });
    FlowContextStorage.set(newFlow);
  };

  useSteps({
    flow,
    enabled: Boolean(
      flow
        && account.address
        && flow.account === account.address
        && flowStatus === "awaiting-steps",
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
        })),
      };

      setFlowAndStatus({
        flow: newFlow,
        flowStatus: "ongoing",
      });
      FlowContextStorage.set(newFlow);
    },
  });

  // update the active flow when the account changes
  useEffect(() => {
    // no account: no active flow
    if (!account.address) {
      if (flow) {
        setFlowAndStatus({ flow: null, flowStatus: null });
      }
      return;
    }

    // no flow: try to restore from local storage
    if (!flow) {
      const flow = FlowContextStorage.get() ?? null;
      const flowStatus = flow ? "ongoing" : null;
      if (flow?.account === account.address) {
        setFlowAndStatus({ flow, flowStatus });
      }
      return;
    }

    // flow exists, but different account: no active flow
    if (account.address !== flow.account) {
      setFlowAndStatus({ flow: null, flowStatus: null });
    }
  }, [account, flow]);

  const contractWrite = useWriteContract();
  const txReceipt = useTransactionReceipt({
    hash: contractWrite.data,
  });

  const signAndSend = useCallback(async () => {
    const currentStepId = flow?.steps?.[currentStepIndex]?.id;

    if (!currentStepId || currentStepIndex < 0 || !account) {
      return;
    }

    updateStep(currentStepIndex, {
      error: null,
      txHash: null,
    });

    const params = await getFlowDeclaration(flow.request.flowId).writeContractParams({
      contracts,
      request: flow.request,
      stepId: currentStepId,
    });

    if (params) {
      contractWrite.writeContract(params, {
        onError: (err) => {
          updateStep(currentStepIndex, {
            error: `${err.name}: ${err.message}`,
            txHash: null,
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
    updateStep,
  ]);

  const totalSteps = flow?.steps?.length ?? 0;

  useEffect(() => {
    if (txReceipt.status !== "pending") {
      contractWrite.reset();
    }
    if (txReceipt.status === "success") {
      updateStep(currentStepIndex, {
        error: null,
        txHash: txReceipt.data.transactionHash,
      });
      if (totalSteps > 0 && currentStepIndex === totalSteps - 1) {
        setFlowAndStatus({
          flow: flow,
          flowStatus: "completed",
        });
      }
    }
    if (txReceipt.status === "error") {
      updateStep(currentStepIndex, {
        error: txReceipt.error.message,
        txHash: null,
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
        currentStepIndex,
        discard,
        start,
        flow,
        flowStatus,
        signAndSend,
      }}
    >
      {children}
    </TransactionFlowContext.Provider>
  );
}

function useSteps({
  flow,
  enabled,
  account,
  contracts,
  wagmiConfig,
  onSteps,
}: {
  flow: FlowContext<FlowRequest> | null;
  enabled: boolean;
  account: ReturnType<typeof useAccount>;
  contracts: ReturnType<typeof useContracts>;
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
        return;
      }

      return getFlowDeclaration(flow.request.flowId).getSteps({
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
