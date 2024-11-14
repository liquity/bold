import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { MAX_ANNUAL_INTEREST_RATE, MIN_ANNUAL_INTEREST_RATE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getPrefixedTroveId, usePredictAdjustInterestRateUpfrontFee } from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { isTroveId } from "@/src/types";
import { vPositionLoanCommited } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO } from "@liquity2/uikit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { readContract } from "wagmi/actions";

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

  prevLoan: vPositionLoanCommited(),
  loan: vPositionLoanCommited(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step =
  | "adjustInterestRate"
  | "setInterestBatchManager"
  | "unsetInterestBatchManager";

export const updateLoanInterestRate: FlowDeclaration<Request, Step> = {
  title: "Review & Confirm",
  Summary({ flow }) {
    const { request } = flow;
    const { loan, prevLoan } = request;

    const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
      loan.collIndex,
      loan.troveId,
      loan.batchManager ?? loan.interestRate,
      prevLoan.batchManager !== null,
    );

    const borrowedWithFee = upfrontFee.data && dn.add(loan.borrowed, upfrontFee.data);

    const loadingState = match(upfrontFee)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: P.nonNullable }, () => "success")
      .exhaustive();

    return (
      <LoanCard
        leverageMode={false}
        loadingState={loadingState}
        loan={{
          ...loan,
          borrowed: borrowedWithFee ?? dnum18(0),
        }}
        prevLoan={prevLoan}
        onRetry={() => {
          upfrontFee.refetch();
        }}
        txPreviewMode
      />
    );
  },
  Details({ flow }) {
    const { request } = flow;
    const { loan, prevLoan } = request;

    const yearlyBoldInterest = dn.mul(loan.borrowed, loan.interestRate);

    return loan.batchManager
      ? (
        <TransactionDetailsRow
          label="Interest rate delegate"
          value={[
            <AccountButton key="start" address={loan.batchManager} />,
            <div key="end">
              {fmtnum(loan.interestRate, "full", 100)}% (~{fmtnum(yearlyBoldInterest, 4)} BOLD per year)
            </div>,
          ]}
        />
      )
      : (
        <>
          <TransactionDetailsRow
            label="Set interest rate"
            value={[
              <div key="start">
                {fmtnum(loan.interestRate, "full", 100)}%
              </div>,
              <div
                key="end"
                title={`${fmtnum(yearlyBoldInterest, "full")} BOLD per year`}
              >
                ~{fmtnum(yearlyBoldInterest, 4)} BOLD per year
              </div>,
            ]}
          />
          {prevLoan.batchManager && (
            <TransactionDetailsRow
              label="Remove interest rate delegate"
              value={[
                <div
                  key="start"
                  className={css({
                    textDecoration: "line-through",
                  })}
                >
                  <AccountButton address={prevLoan.batchManager} />
                </div>,
                <div
                  key="end"
                  className={css({
                    textDecoration: "line-through",
                  })}
                >
                  {fmtnum(prevLoan.interestRate, "full", 100)}% (~{fmtnum(
                    dn.mul(prevLoan.borrowed, prevLoan.interestRate),
                    4,
                  )} BOLD per year)
                </div>,
              ]}
            />
          )}
        </>
      );
  },
  async getSteps({ request, contracts, wagmiConfig }) {
    const loan = request.loan;
    const collateral = contracts.collaterals[loan.collIndex];

    if (loan.batchManager) {
      return ["setInterestBatchManager"];
    }

    const isInBatch = (await readContract(wagmiConfig, {
      ...collateral.contracts.BorrowerOperations,
      functionName: "interestBatchManagerOf",
      args: [BigInt(loan.troveId)],
    })) !== ADDRESS_ZERO;

    return isInBatch ? ["unsetInterestBatchManager"] : ["adjustInterestRate"];
  },

  getStepName(stepId) {
    return match(stepId)
      .with("adjustInterestRate", () => "Update interest rate")
      .with("setInterestBatchManager", () => "Set interest rate delegate")
      .with("unsetInterestBatchManager", () => "Update interest rate")
      .exhaustive();
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    const { loan } = request;
    const { BorrowerOperations } = contracts.collaterals[loan.collIndex].contracts;

    if (stepId === "adjustInterestRate") {
      return {
        ...BorrowerOperations,
        functionName: "adjustTroveInterestRate" as const,
        args: [
          BigInt(loan.troveId),
          loan.interestRate[0],
          0n,
          0n,
          maxUint256,
        ],
      };
    }

    if (stepId === "unsetInterestBatchManager") {
      return {
        ...BorrowerOperations,
        functionName: "removeFromBatch" as const,
        args: [
          BigInt(loan.troveId),
          loan.interestRate[0],
          0n,
          0n,
          maxUint256,
        ],
      };
    }

    if (stepId === "setInterestBatchManager") {
      return {
        ...BorrowerOperations,
        functionName: "setInterestBatchManager" as const,
        args: [
          BigInt(loan.troveId),
          loan.batchManager,
          MIN_ANNUAL_INTEREST_RATE[0],
          MAX_ANNUAL_INTEREST_RATE[0],
          maxUint256,
        ],
      };
    }

    return null;
  },
  async postFlowCheck({ request, steps }) {
    const lastStep = steps?.at(-1);
    if (lastStep?.txStatus !== "post-check" || !isTroveId(lastStep.txReceiptData)) {
      return;
    }

    const { loan } = request;
    const lastUpdate = loan.updatedAt;

    const prefixedTroveId = getPrefixedTroveId(
      loan.collIndex,
      lastStep.txReceiptData,
    );

    while (true) {
      const { trove } = await graphQuery(TroveByIdQuery, { id: prefixedTroveId });

      // trove found and updated: check done
      if (trove && Number(trove.updatedAt) * 1000 !== lastUpdate) {
        break;
      }
    }
  },
};
