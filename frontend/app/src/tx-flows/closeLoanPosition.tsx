import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { fmtnum } from "@/src/formatting";
import { useCollateral } from "@/src/liquity-utils";
import { parsePrefixedTroveId } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { useLoanById } from "@/src/subgraph-hooks";
import { vCollIndex, vPrefixedTroveId } from "@/src/valibot-utils";
import { match, P } from "ts-pattern";
import * as v from "valibot";

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

type Step = "closeLoanPosition";

const stepNames: Record<Step, string> = {
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

    return loan.data && (
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
  async getSteps() {
    return ["closeLoanPosition"];
  },
  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
  async writeContractParams({ contracts, request, stepId }) {
    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations } = collateral.contracts;

    if (!BorrowerOperations) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    if (stepId === "closeLoanPosition") {
      const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

      return {
        ...BorrowerOperations,
        functionName: "closeTrove" as const,
        args: [troveId],
      };
    }
    return null;
  },
};
