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
import type { Request as ClaimCollateralSurplusRequest } from "@/src/tx-flows/claimCollateralSurplus";
import type { Request as CloseLoanPositionRequest } from "@/src/tx-flows/closeLoanPosition";
import type { Request as EarnClaimRewardsRequest } from "@/src/tx-flows/earnClaimRewards";
import type { Request as EarnDepositRequest } from "@/src/tx-flows/earnDeposit";
import type { Request as EarnWithdrawRequest } from "@/src/tx-flows/earnWithdraw";
import type { Request as OpenBorrowPositionRequest } from "@/src/tx-flows/openBorrowPosition";
import type { Request as OpenLeveragePositionRequest } from "@/src/tx-flows/openLeveragePosition";
import type { Request as UpdateBorrowPositionRequest } from "@/src/tx-flows/updateBorrowPosition";
import type { Request as UpdateLeveragePositionRequest } from "@/src/tx-flows/updateLeveragePosition";
import type { Request as UpdateLoanInterestRateRequest } from "@/src/tx-flows/updateLoanInterestRate";
import type { Address } from "@/src/types";
import type {
  GetTransactionReceiptReturnType,
  WriteContractParameters,
} from "@wagmi/core";
import type { ComponentType, ReactNode } from "react";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { getContracts } from "@/src/contracts";
import { jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useStoredState } from "@/src/services/StoredState";
import { claimCollateralSurplus } from "@/src/tx-flows/claimCollateralSurplus";
import { closeLoanPosition } from "@/src/tx-flows/closeLoanPosition";
import { earnClaimRewards } from "@/src/tx-flows/earnClaimRewards";
import { earnDeposit } from "@/src/tx-flows/earnDeposit";
import { earnWithdraw } from "@/src/tx-flows/earnWithdraw";
import { openBorrowPosition } from "@/src/tx-flows/openBorrowPosition";
import { openLeveragePosition } from "@/src/tx-flows/openLeveragePosition";
import { updateBorrowPosition } from "@/src/tx-flows/updateBorrowPosition";
import { updateLeveragePosition } from "@/src/tx-flows/updateLeveragePosition";
import { updateLoanInterestRate } from "@/src/tx-flows/updateLoanInterestRate";
import { noop } from "@/src/utils";
import { vAddress, vHash } from "@/src/valibot-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as v from "valibot";
import { useTransactionReceipt, useWriteContract } from "wagmi";
import { useAccount, useWagmiConfig } from "./Arbitrum";

const TRANSACTION_FLOW_KEY = `${LOCAL_STORAGE_PREFIX}transaction_flow`;

export type FlowRequest =
  | ClaimCollateralSurplusRequest
  | CloseLoanPositionRequest
  | EarnClaimRewardsRequest
  | EarnDepositRequest
  | EarnWithdrawRequest
  | OpenBorrowPositionRequest
  | OpenLeveragePositionRequest
  | UpdateBorrowPositionRequest
  | UpdateLeveragePositionRequest
  | UpdateLoanInterestRateRequest;

const flowDeclarations: {
  [K in FlowIdFromFlowRequest<FlowRequest>]: FlowDeclaration<
    Extract<FlowRequest, { flowId: K }>,
    any // Use 'any' here to allow any StepId type
  >;
} = {
  claimCollateralSurplus,
  closeLoanPosition,
  earnClaimRewards,
  earnDeposit,
  earnWithdraw,
  openBorrowPosition,
  openLeveragePosition,
  updateBorrowPosition,
  updateLeveragePosition,
  updateLoanInterestRate,
};

const FlowIdSchema = v.union([
  v.literal("claimCollateralSurplus"),
  v.literal("closeLoanPosition"),
  v.literal("earnClaimRewards"),
  v.literal("earnDeposit"),
  v.literal("earnWithdraw"),
  v.literal("openBorrowPosition"),
  v.literal("openLeveragePosition"),
  v.literal("updateBorrowPosition"),
  v.literal("updateLeveragePosition"),
  v.literal("updateLoanInterestRate"),
]);

type ExtractStepId<T> = T extends FlowDeclaration<any, infer S> ? S : never;

type FlowDeclarations = {
  [K in FlowIdFromFlowRequest<FlowRequest>]: FlowDeclaration<
    Extract<FlowRequest, { flowId: K }>,
    ExtractStepId<(typeof flowDeclarations)[K]>
  >;
};

export type FlowId = keyof FlowDeclarations;

function getFlowDeclaration<T extends FlowIdFromFlowRequest<FlowRequest>>(
  flowId: T
): FlowDeclaration<
  Extract<FlowRequest, { flowId: T }>,
  ExtractStepId<(typeof flowDeclarations)[T]>
> {
  return flowDeclarations[flowId];
}

export type FlowIdFromFlowRequest<FR extends FlowRequest> = FR["flowId"];
export type FlowRequestFromFlowId<FI extends FlowId> = Extract<
  FlowRequest,
  { flowId: FI }
>;
export type FlowContextFromFlowId<FI extends FlowId> = FlowContext<
  FlowRequestFromFlowId<FI>
>;

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
        txStatus: v.union([v.literal("post-check"), v.literal("confirmed")]),
      }),
    ])
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
      txStatus: "post-check" | "confirmed";
      txReceiptData: null | string;
    };

export type FlowSteps = NonNullable<v.InferOutput<typeof FlowStepsSchema>>;

export type FlowStepStatus = FlowSteps[number]["txStatus"];

// The context of a transaction flow, as stored in local storage,
// not to be confused with the React context used to manage the flow.
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
  storedState: ReturnType<typeof useStoredState>;
  wagmiConfig: ReturnType<typeof useWagmiConfig>;
};

type GetStepsFn<FR extends FlowRequest, StepId extends string> = (
  args: FlowArgs<FR>
) => Promise<StepId[]>;

type WriteContractParamsFn<FR extends FlowRequest, StepId extends string> = (
  stepId: StepId,
  args: FlowArgs<FR>
) => Promise<null | WriteContractParameters>;

export type FlowDeclaration<
  FR extends FlowRequest,
  StepId extends string = string,
> = {
  title: ReactNode;
  Summary: ComponentType<{ flow: FlowContext<FR> }>;
  Details: ComponentType<{ flow: FlowContext<FR> }>;

  // optional, if present it will be called at the end of the
  // last step of the flow, before the success status gets activated
  postFlowCheck?: (args: FlowArgs<FR>) => Promise<void>;
  getSteps: GetStepsFn<FR, StepId>;
  getStepName: (
    stepId: StepId,
    args: {
      contracts: Contracts;
      request: FR;
    }
  ) => string;
  parseRequest: (request: unknown) => FR | null;
  parseReceipt?: (
    stepId: StepId,
    receipt: GetTransactionReceiptReturnType,
    args: {
      contracts: Contracts;
      request: FR;
    }
  ) => null | string;
  writeContractParams: WriteContractParamsFn<FR, StepId>;
};

type TransactionFlowReactContext<FR extends FlowRequest = FlowRequest> = {
  currentStep: null | FlowSteps[number];
  currentStepIndex: number;
  discard: () => void;
  signAndSend: () => Promise<void>;
  start: (request: FR) => void;
  flow: null | FlowContext<FR>;
  flowDeclaration: null | FlowDeclaration<
    FR,
    ExtractStepId<(typeof flowDeclarations)[FR["flowId"]]>
  >;
};

const TransactionFlowContext = createContext<TransactionFlowReactContext>({
  currentStep: null,
  currentStepIndex: -1,
  discard: noop,
  signAndSend: async () => {},
  start: noop,
  flow: null,
  flowDeclaration: null,
});

export function TransactionFlow({ children }: { children: ReactNode }) {
  const account = useAccount();
  const router = useRouter();
  const wagmiConfig = useWagmiConfig();

  const {
    currentStep,
    currentStepIndex,
    discardFlow,
    flow,
    flowDeclaration,
    setFlowSteps,
    startFlow,
    updateFlowStep,
  } = useFlowManager(account.address ?? null);

  useSteps({
    flow,
    enabled: Boolean(
      flow &&
        account.address &&
        flow.account === account.address &&
        flow.steps === null
    ),
    account,
    wagmiConfig,
    onSteps: (steps) => {
      setFlowSteps(
        steps.map((id) => ({
          id,
          error: null,
          txHash: null,
          txReceiptData: null,
          txStatus: "idle" as const,
        }))
      );
    },
  });

  const txExecution = useTransactionExecution({
    flow,
    currentStep,
    currentStepIndex,
    flowDeclaration,
    updateFlowStep,
  });

  const start: TransactionFlowReactContext["start"] = useCallback(
    (request) => {
      if (account.address) {
        startFlow(request, account.address);
        setTimeout(() => {
          router.push("/transactions");
        }, 0);
      }
    },
    [account]
  );

  return (
    <TransactionFlowContext.Provider
      value={{
        currentStep,
        currentStepIndex,
        discard: discardFlow,
        start,
        flow,
        flowDeclaration,
        signAndSend: txExecution.signAndSend,
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
  wagmiConfig,
  onSteps,
}: {
  flow: FlowContext<FR> | null;
  enabled: boolean;
  account: ReturnType<typeof useAccount>;
  wagmiConfig: ReturnType<typeof useWagmiConfig>;
  onSteps: (steps: string[]) => void;
}) {
  const contracts = getContracts();
  const storedState = useStoredState();

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
        storedState,
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

export function useFlowManager(account: Address | null) {
  const [flow, setFlow] = useState<FlowContext<FlowRequest> | null>(null);

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

  const startFlow = useCallback((request: FlowRequest, account: Address) => {
    const newFlow = { account, request, steps: null };
    setFlow(newFlow);
    FlowContextStorage.set(newFlow);
  }, []);

  const discardFlow = useCallback(() => {
    setFlow(null);
    FlowContextStorage.clear();
  }, []);

  const setFlowSteps = useCallback(
    (steps: FlowSteps | null) => {
      if (!flow) return;

      const newFlow = { ...flow, steps };
      setFlow(newFlow);
      FlowContextStorage.set(newFlow);
    },
    [flow]
  );

  const updateFlowStep = useCallback(
    (stepIndex: number, update: FlowStepUpdate) => {
      if (!flow) return;

      const newSteps =
        flow.steps?.map((step, i) =>
          i === stepIndex ? { ...step, ...update } : step
        ) ?? null;

      setFlowSteps(newSteps);
    },
    [flow, setFlowSteps]
  );

  const currentStepIndex = useMemo(() => {
    const firstUnconfirmed =
      flow?.steps?.findIndex((step) => step.txStatus !== "confirmed") ?? -1;
    return firstUnconfirmed === -1
      ? (flow?.steps?.length ?? 0) - 1
      : firstUnconfirmed;
  }, [flow]);

  const currentStep = useMemo(
    () => flow?.steps?.[currentStepIndex] ?? null,
    [flow, currentStepIndex]
  );

  const flowDeclaration = useMemo(
    () => flow && getFlowDeclaration(flow.request.flowId),
    [flow]
  );

  const isFlowComplete = useMemo(
    () => flow?.steps?.at(-1)?.txStatus === "confirmed",
    [flow]
  );

  useResetQueriesOnPathChange(isFlowComplete);

  return {
    currentStep,
    currentStepIndex,
    discardFlow,
    flow,
    flowDeclaration,
    isFlowComplete,
    setFlowSteps,
    startFlow,
    updateFlowStep,
  };
}

function useTransactionExecution({
  flow,
  currentStep,
  currentStepIndex,
  flowDeclaration,
  updateFlowStep,
}: {
  flow: FlowContext<FlowRequest> | null;
  currentStep: FlowSteps[number] | null;
  currentStepIndex: number;
  flowDeclaration: FlowDeclaration<FlowRequest> | null;
  updateFlowStep: (index: number, update: FlowStepUpdate) => void;
}) {
  const account = useAccount();
  const contracts = getContracts();
  const wagmiConfig = useWagmiConfig();
  const storedState = useStoredState();

  // step status updates
  const setStepToAwaitingSignature = () => {
    updateFlowStep(currentStepIndex, {
      error: null,
      txHash: null,
      txReceiptData: null,
      txStatus: "awaiting-signature",
    });
  };
  const setStepToAwaitingConfirmation = (txHash: `0x${string}`) => {
    updateFlowStep(currentStepIndex, {
      error: null,
      txHash,
      txReceiptData: null,
      txStatus: "awaiting-confirmation",
    });
  };
  const setStepToPostCheck = (receipt: GetTransactionReceiptReturnType) => {
    if (!flow?.request) return;
    updateFlowStep(currentStepIndex, {
      error: null,
      txHash: receipt.transactionHash,
      txReceiptData:
        flowDeclaration?.parseReceipt?.(
          flow.steps?.[currentStepIndex]?.id ?? "",
          receipt,
          { contracts, request: flow.request }
        ) ?? null,
      txStatus: "post-check",
    });
  };
  const setStepToConfirmed = (receipt: GetTransactionReceiptReturnType) => {
    if (!flow?.request) return;
    updateFlowStep(currentStepIndex, {
      error: null,
      txHash: receipt.transactionHash,
      txReceiptData:
        flowDeclaration?.parseReceipt?.(
          flow.steps?.[currentStepIndex]?.id ?? "",
          receipt,
          { contracts, request: flow.request }
        ) ?? null,
      txStatus: "confirmed",
    });
  };
  const setStepToError = (
    error: Error,
    txHash: `0x${string}` | null = null
  ) => {
    updateFlowStep(currentStepIndex, {
      error: error.message,
      txHash,
      txReceiptData: null,
      txStatus: "error",
    });
  };

  const contractWrite = useWriteContract({
    mutation: {
      onMutate: setStepToAwaitingSignature,
      onError: (err) => setStepToError(err),
      onSuccess: setStepToAwaitingConfirmation,
    },
  });

  const txReceipt = useTransactionReceipt({
    hash:
      contractWrite.data ??
      ((currentStep?.txStatus === "awaiting-confirmation" &&
        currentStep.txHash) ||
        undefined),
    query: { retry: true },
  });

  const runPostCheck = useCallback(
    async (receipt: GetTransactionReceiptReturnType) => {
      if (!flow?.request || !flowDeclaration?.postFlowCheck) {
        return;
      }

      while (true) {
        try {
          await flowDeclaration.postFlowCheck({
            account,
            contracts,
            request: flow.request,
            steps: flow.steps,
            storedState,
            wagmiConfig,
          });
          // check passed
          setStepToConfirmed(receipt);
          break;
        } catch (error) {
          console.error("Post-check failed, retrying in 1 second", error);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    },
    [account, contracts, flow, flowDeclaration, storedState, wagmiConfig]
  );

  const postCheckReceipt = useRef<GetTransactionReceiptReturnType | null>(null);

  useEffect(() => {
    if (txReceipt.status !== "pending") {
      contractWrite.reset();
    }

    if (txReceipt.status === "error") {
      setStepToError(txReceipt.error);
      return;
    }

    if (txReceipt.data?.status === "reverted") {
      setStepToError(
        new Error("Transaction reverted."),
        txReceipt.data.transactionHash
      );
      return;
    }

    if (txReceipt.status === "success") {
      const isLastStep = currentStepIndex === (flow?.steps?.length ?? 0) - 1;

      if (isLastStep && flowDeclaration?.postFlowCheck) {
        postCheckReceipt.current = txReceipt.data;
        setStepToPostCheck(txReceipt.data);
      } else {
        setStepToConfirmed(txReceipt.data);
      }
    }
  }, [txReceipt]);

  useEffect(() => {
    if (currentStep?.txStatus === "post-check" && postCheckReceipt.current) {
      runPostCheck(postCheckReceipt.current).catch(console.error);
    }
  }, [currentStep?.txStatus, runPostCheck]);

  const signAndSend = useCallback(async () => {
    const currentStepId = flow?.steps?.[currentStepIndex]?.id;

    if (
      !currentStepId ||
      currentStepIndex < 0 ||
      !account ||
      !flow ||
      !flowDeclaration
    ) {
      return;
    }

    const writeParams = await flowDeclaration.writeContractParams(
      currentStepId,
      {
        account,
        contracts,
        request: flow.request,
        steps: flow.steps,
        storedState,
        wagmiConfig,
      }
    );

    if (writeParams) {
      contractWrite.writeContract(writeParams);
    }
  }, [
    account,
    contractWrite,
    contracts,
    currentStepIndex,
    flow,
    flowDeclaration,
    wagmiConfig,
  ]);

  return {
    signAndSend,
    isProcessing: txReceipt.status === "pending",
  };
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
    }
  }, [condition, pathName, queryClient]);
}

const FlowContextStorage = {
  set(flow: FlowContext<FlowRequest>) {
    localStorage.setItem(TRANSACTION_FLOW_KEY, jsonStringifyWithDnum(flow));
  },
  get(): FlowContext<FlowRequest> | null {
    try {
      const storedFlowState = (
        localStorage.getItem(TRANSACTION_FLOW_KEY) ?? ""
      ).trim();
      if (!storedFlowState) return null;

      const { request, steps, account } = v.parse(
        FlowStateSchema,
        jsonParseWithDnum(storedFlowState)
      );
      const declaration = getFlowDeclaration(request.flowId);
      const parsedRequest = declaration.parseRequest(request);
      let parsedSteps = v.parse(FlowStepsSchema, steps);

      if (account && parsedRequest && parsedSteps) {
        parsedSteps = parsedSteps.map((step) =>
          step.txStatus === "post-check"
            ? { ...step, txStatus: "confirmed" }
            : step
        );

        return {
          account,
          request: parsedRequest,
          steps: parsedSteps,
        };
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      console.error(err);
      // clean up invalid state
      localStorage.removeItem(TRANSACTION_FLOW_KEY);
    }
    return null;
  },
  clear() {
    localStorage.removeItem(TRANSACTION_FLOW_KEY);
  },
};

export function useTransactionFlow() {
  return useContext(TransactionFlowContext);
}
