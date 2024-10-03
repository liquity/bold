import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { fmtnum } from "@/src/formatting";
import { parsePrefixedTroveId } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { useLoanById } from "@/src/subgraph-hooks";
import { vAddress, vCollIndex, vDnum, vPrefixedTroveId } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";

const FlowIdSchema = v.literal("updateLoanInterestRate");

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
  interestRate: vDnum(),
  lowerHint: vDnum(),
  maxUpfrontFee: vDnum(),
  owner: vAddress(),
  prefixedTroveId: vPrefixedTroveId(),
  upperHint: vDnum(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "adjustInterestRate";

const stepNames: Record<Step, string> = {
  adjustInterestRate: "Update Interest Rate",
};

export const updateLoanInterestRate: FlowDeclaration<Request, Step> = {
  title: "Review & Confirm",
  subtitle: "Please review the changes of your borrow position before confirming",
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
        loan={!loan.data ? null : {
          ...loan.data,
          interestRate: flow.request.interestRate,
        }}
        prevLoan={loan.data}
        onRetry={() => {}}
      />
    );
  },
  Details({ flow }) {
    const { request } = flow;

    const loan = useLoanById(flow.request.prefixedTroveId);
    const boldPerYear = dn.mul(loan.data?.borrowed ?? 0n, request.interestRate);

    return (
      <TransactionDetailsRow
        label="Interest rate"
        value={[
          <div>
            {fmtnum(request.interestRate, "full", 100)}%
          </div>,
          <div title={`${fmtnum(boldPerYear, "full")} BOLD per year`}>
            ~{fmtnum(boldPerYear, 4)} BOLD per year
          </div>,
        ]}
      />
    );
  },
  getStepName(stepid) {
    return stepNames[stepid];
  },
  async getSteps() {
    return ["adjustInterestRate"];
  },
  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
  async writeContractParams(stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations } = collateral.contracts;

    if (!BorrowerOperations) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    if (stepId === "adjustInterestRate") {
      const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);
      return {
        ...BorrowerOperations,
        functionName: "adjustTroveInterestRate" as const,
        args: [
          troveId,
          request.interestRate[0],
          request.upperHint[0],
          request.lowerHint[0],
          request.maxUpfrontFee[0],
        ],
      };
    }
    return null;
  },
};
