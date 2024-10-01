import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { fmtnum } from "@/src/formatting";
import { useCollateral } from "@/src/liquity-utils";
import { parsePrefixedTroveId } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { useLoanById } from "@/src/subgraph-hooks";
import { vCollIndex, vPrefixedTroveId } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("closeLoanPosition");

const RequestSchema = v.object({
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
  successMessage: v.string(),

  collIndex: vCollIndex(),
  prefixedTroveId: vPrefixedTroveId(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "closeLoanPosition" | "approveBold";

const stepNames: Record<Step, string> = {
  approveBold: "Approve BOLD",
  closeLoanPosition: "Close Position",
};

export const closeLoanPosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  subtitle: (
    <div
      style={{
        textAlign: "center",
      }}
    >
      You are repaying your debt and closing this position.<br />
      The deposit will be returned to your wallet
    </div>
  ),

  Summary({ flow }) {
    const loan = useLoanById(flow.request.prefixedTroveId);

    const loadingState = match(loan)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    return (
      <LoanCard
        leverageMode={false}
        loadingState={loadingState}
        loan={null}
        prevLoan={loan.data}
        onRetry={() => {}}
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const collateral = useCollateral(request.collIndex);
    const loan = useLoanById(request.prefixedTroveId);

    return loan.data && collateral && (
      <>
        <TransactionDetailsRow
          label="You repay with"
          value={[
            <div>
              {fmtnum(loan.data.borrowed, 4)} BOLD
            </div>,
          ]}
        />
        <TransactionDetailsRow
          label="You reclaim"
          value={[
            <div title={`${fmtnum(loan.data.deposit, "full")} ${collateral.symbol}`}>
              {fmtnum(loan.data.deposit, "2z")} {collateral.symbol}
            </div>,
          ]}
        />
      </>
    );
  },

  getStepName(stepid) {
    return stepNames[stepid];
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const { collIndex, prefixedTroveId } = request;
    const coll = contracts.collaterals[collIndex];

    const Controller = coll.symbol === "ETH"
      ? coll.contracts.WETHZapper
      : coll.contracts.BorrowerOperations;

    if (!account.address) {
      throw new Error("Account address is required");
    }

    const { troveId } = parsePrefixedTroveId(prefixedTroveId);

    const [debt] = await readContract(wagmiConfig, {
      ...coll.contracts.TroveManager,
      functionName: "Troves",
      args: [BigInt(troveId)],
    });

    const isBoldApproved = !dn.gt(debt, [
      await readContract(wagmiConfig, {
        ...contracts.BoldToken,
        functionName: "allowance",
        args: [account.address, Controller.address],
      }) ?? 0n,
      18,
    ]);

    return [
      isBoldApproved ? null : "approveBold" as const,
      "closeLoanPosition" as const,
    ].filter((step) => step !== null);
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request, wagmiConfig }) {
    const coll = contracts.collaterals[request.collIndex];
    const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

    if (stepId === "approveBold") {
      const [debt] = await readContract(wagmiConfig, {
        ...coll.contracts.TroveManager,
        functionName: "Troves",
        args: [BigInt(troveId)],
      });

      const Controller = coll.symbol === "ETH"
        ? coll.contracts.WETHZapper
        : coll.contracts.BorrowerOperations;

      return {
        ...contracts.BoldToken,
        functionName: "approve",
        args: [Controller.address, dn.mul([debt, 18], 1.1)[0]], // TODO: calculate the amount to approve in a more precise way
      };
    }

    // WETHZapper mode
    if (coll.symbol === "ETH" && stepId === "closeLoanPosition") {
      return {
        ...coll.contracts.WETHZapper,
        functionName: "closeTroveToRawETH" as const,
        args: [troveId],
      };
    }

    if (stepId === "closeLoanPosition") {
      return {
        ...coll.contracts.BorrowerOperations,
        functionName: "closeTrove" as const,
        args: [troveId],
      };
    }

    throw new Error("Invalid stepId: " + stepId);
  },
};
