"use client";

// The TransactionFlow component represents a series of one transactions
// executed in sequence. It only stores the last series of transactions.
//
// Naming conventions:
// - Flow: A series of transactions that are executed in sequence.
// - Flow steps: Series of transactions in a flow.
// - Request: The initial request that starts a flow.
// - Flow declaration: Contains the logic for a specific flow.
// - Flow state: The state of a transaction flow, as stored in local storage (steps + request).

import type { Request as OpenLoanPositionRequest } from "@/src/tx-flows/openLoanPosition.ts";
import type { Request as RepayAndCloseLoanPositionRequest } from "@/src/tx-flows/repayAndCloseLoanPosition.ts";
import type { Request as UpdateLoanPositionRequest } from "@/src/tx-flows/updateLoanPosition.ts";
import type { Address } from "@/src/types";
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
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

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
  [K in FlowId<FlowRequest>]: FlowDeclaration<Extract<FlowRequest, { flowId: K }>>;
};

function getFlowDeclaration<T extends FlowId<FlowRequest>>(
  flowId: T,
): FlowDeclaration<Extract<FlowRequest, { flowId: T }>> {
  return flowDeclarations[flowId];
}

type FlowId<FR extends FlowRequest> = FR["flowId"];

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

// The state of a transaction flow, as stored in local storage
export type FlowState<FR extends FlowRequest> = {
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
}) => Promise<Parameters<ReturnType<typeof useWriteContract>["writeContract"]>[0] | null>;

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
  flow: FlowState<FR> | null;
};

const TransactionFlowContext = createContext<Context>({
  currentStepIndex: -1,
  discard: noop,
  signAndSend: async () => {},
  start: noop,
  flow: null,
});

type ComponentState = {
  flow: null | FlowState<FlowRequest>;
  flowStatus:
    | null // no flow
    | "awaiting-steps" // waiting for steps to be fetched (when start() gets called)
    | "ready"; // flow loaded and ready to be executed
};

export function TransactionFlow({ children }: { children: ReactNode }) {
  const wagmiConfig = useWagmiConfig();
  const account = useAccount();
  const contracts = useContracts();

  const [{
    flow,
    flowStatus,
  }, setState] = useState<ComponentState>(() => {
    const flow = flowStateStorage.get() ?? null;
    const flowStatus = flow ? "ready" : null;
    return { flow, flowStatus };
  });

  const currentStepIndex = flow?.steps && flow?.steps.at(-1)?.txHash
    ? flow?.steps.length - 1
    : (flow?.steps?.findIndex((step) => !step.txHash) ?? -1);

  // initiate a new transaction flow
  const start: Context["start"] = useCallback((request) => {
    if (account.address) {
      setState({
        flow: {
          account: account.address,
          request,
          steps: null,
        },
        flowStatus: "awaiting-steps",
      });
    }
  }, [account]);

  // discard the current transaction flow (remove it from local storage)
  const discard: Context["discard"] = useCallback(() => {
    flowStateStorage.clear();
    setState({ flow: null, flowStatus: null });
  }, []);

  const stepsQuery = useQuery({
    enabled: Boolean(
      flow
        && account.address
        && flow.account === account.address
        && flowStatus === "awaiting-steps",
    ),
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

  // update the flow with the newly received steps
  useEffect(() => {
    if (flow && flowStatus === "awaiting-steps" && stepsQuery.data) {
      setState((state) => (
        (!state.flow || !stepsQuery.data) ? state : {
          ...state,
          flow: {
            ...state.flow,
            steps: stepsQuery.data.map((id) => ({
              id,
              error: null,
              txHash: null,
            })),
          },
        }
      ));
    }
  }, [
    flowStatus,
    stepsQuery.data?.join(""),
    currentStepIndex,
  ]);

  // update the active flow when the account changes
  useEffect(() => {
    // no account: no active flow
    if (!account.address) {
      if (flow) {
        setState({ flow: null, flowStatus: null });
      }
      return;
    }

    // no flow: try to restore from local storage
    if (!flow) {
      const flow = flowStateStorage.get() ?? null;
      const flowStatus = flow ? "ready" : null;
      if (flow?.account === account.address) {
        setState({ flow, flowStatus });
      }
      return;
    }

    // flow exists, but different account: no active flow
    if (account.address !== flow.account) {
      setState({ flow: null, flowStatus: null });
    }
  }, [account, flow]);

  // store flow in local storage on every update
  useEffect(() => {
    if (currentStepIndex > -1 && flow) {
      flowStateStorage.set(flow);
    }
  }, [currentStepIndex, flow]);

  const contractWrite = useWriteContract();
  const txReceipt = useWaitForTransactionReceipt({
    hash: contractWrite.data,
  });

  const signAndSend = useCallback(async () => {
    const currentStepId = flow?.steps?.[currentStepIndex]?.id;

    if (!currentStepId || currentStepIndex < 0 || !account) {
      return;
    }

    const params = await getFlowDeclaration(flow.request.flowId).writeContractParams({
      contracts,
      request: flow.request,
      stepId: currentStepId,
    });

    if (params) {
      contractWrite.writeContractAsync(params);
    }
  }, [
    account,
    contractWrite,
    contracts,
    currentStepIndex,
    flow,
  ]);

  // update the flow status when the contract write status changes
  useEffect(() => {
    if (contractWrite.status === "idle") {
      return;
    }

    if (contractWrite.status === "error") {
      const error = `${contractWrite.error.name}: ${contractWrite.error.message}`;

      contractWrite.reset();

      setState((state) => {
        if (!state.flow || !state.flow.steps) {
          return state;
        }

        const steps = [...state.flow.steps];

        steps[currentStepIndex] = {
          ...steps[currentStepIndex],
          error,
        };

        return {
          ...state,
          flow: { ...state.flow, steps },
        };
      });
    }

    if (contractWrite.status === "success") {
      contractWrite.reset();

      setState((state) => {
        if (!state.flow || !state.flow.steps) {
          return state;
        }

        const steps = [...state.flow.steps];

        steps[currentStepIndex] = {
          ...steps[currentStepIndex],
          error: null,
          txHash: contractWrite.data,
        };

        return {
          ...state,
          flow: { ...state.flow, steps },
        };
      });
    }
  }, [
    contractWrite.error,
    contractWrite.reset,
    contractWrite.status,
  ]);

  useEffect(() => {
    if (txReceipt.status === "success") {
      setState((state) => {
        if (!state.flow || !state.flow.steps) {
          return state;
        }

        const steps = [...state.flow.steps];
        const step = steps[currentStepIndex];
        steps[currentStepIndex] = {
          ...step,
          txHash: txReceipt.data.transactionHash,
        };

        return {
          ...state,
          flow: { ...state.flow, steps },
        };
      });
    }
    if (txReceipt.status === "error") {
      setState((state) => {
        if (!state.flow || !state.flow.steps) {
          return state;
        }

        const steps = [...state.flow.steps];
        const step = steps[currentStepIndex];
        steps[currentStepIndex] = {
          ...step,
          error: `${txReceipt.error.name}: ${txReceipt.error.message}`,
        };

        return {
          ...state,
          flow: { ...state.flow, steps },
        };
      });
    }
  }, [txReceipt]);

  return (
    <TransactionFlowContext.Provider
      value={{
        currentStepIndex,
        discard,
        start,
        flow,
        signAndSend,
      }}
    >
      {children}
    </TransactionFlowContext.Provider>
  );
}

export function useTransactionFlow() {
  return useContext(TransactionFlowContext);
}

const flowStateStorage = {
  set(flow: FlowState<FlowRequest>) {
    localStorage.setItem(TRANSACTION_FLOW_KEY, jsonStringifyWithDnum(flow));
  },
  get(): FlowState<FlowRequest> | null {
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
