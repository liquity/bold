import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import {
  getBranch,
  getTroveOperationHints,
  useInterestBatchDelegate,
  usePredictAdjustInterestRateUpfrontFee,
} from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vPositionLoanCommited } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import { match } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "updateLoanInterestRate",
  {
    prevLoan: vPositionLoanCommited(),
    loan: vPositionLoanCommited(),
  },
);

export type UpdateLoanInterestRateRequest = v.InferOutput<typeof RequestSchema>;

export const updateLoanInterestRate: FlowDeclaration<UpdateLoanInterestRateRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { loan, prevLoan } = request;
    const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
      loan.branchId,
      loan.troveId,
      loan.batchManager ?? loan.interestRate,
      prevLoan.batchManager !== null,
    );

    const borrowedWithFee = upfrontFee.data && dn.add(loan.borrowed, upfrontFee.data);
    const loadingState = match(upfrontFee)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ status: "success" }, () => "success")
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

  Details({ request }) {
    const { loan, prevLoan } = request;

    const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
      loan.branchId,
      loan.troveId,
      loan.batchManager ?? loan.interestRate,
      prevLoan.batchManager !== null,
    );

    const delegate = useInterestBatchDelegate(loan.branchId, loan.batchManager);
    const yearlyBoldInterest = dn.mul(
      loan.borrowed,
      dn.add(loan.interestRate, delegate.data?.fee ?? 0),
    );

    const prevDelegate = useInterestBatchDelegate(loan.branchId, prevLoan.batchManager);
    const prevYearlyBoldInterest = dn.mul(
      prevLoan.borrowed,
      dn.add(prevLoan.interestRate, prevDelegate.data?.fee ?? 0),
    );

    return loan.batchManager
      ? (
        <TransactionDetailsRow
          label="Interest rate delegate"
          value={[
            <AccountButton key="start" address={loan.batchManager} />,
            <div key="end">
              {delegate.isLoading
                ? "Loading…"
                : (
                  <>
                    <Amount
                      value={loan.interestRate}
                      format="pct2z"
                      percentage
                    />{" "}
                    <Amount
                      percentage
                      format="pct2"
                      prefix="+ "
                      suffix="% delegate fee"
                      fallback="…"
                      value={delegate.data?.fee}
                    />
                    <br />
                    <Amount
                      format="2z"
                      prefix="~"
                      suffix=" BOLD per year"
                      value={yearlyBoldInterest}
                    />
                  </>
                )}
            </div>,
          ]}
        />
      )
      : (
        <>
          <TransactionDetailsRow
            label="New interest rate"
            value={[
              <div key="start">
                {fmtnum(loan.interestRate, "pctfull")}%
              </div>,
              <div
                key="end"
                title={`${fmtnum(yearlyBoldInterest, "full")} BOLD per year`}
              >
                {fmtnum(yearlyBoldInterest, {
                  digits: 4,
                  dust: false,
                  prefix: "~",
                })} BOLD per year
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
                  <Amount
                    value={prevLoan.interestRate}
                    format="pct2z"
                    percentage
                  />{" "}
                  <Amount
                    percentage
                    format="pct2"
                    prefix="+ "
                    suffix="% delegate fee"
                    fallback="…"
                    value={prevDelegate.data?.fee}
                  />
                  <br />
                  <Amount
                    format="2z"
                    prefix="~"
                    suffix=" BOLD per year"
                    value={prevYearlyBoldInterest}
                  />
                </div>,
              ]}
            />
          )}
          {upfrontFee.data && dn.gt(upfrontFee.data, 0) && (
            <TransactionDetailsRow
              label={
                <div
                  className={css({
                    display: "flex",
                    gap: 4,
                  })}
                >
                  <div>Interest rate adjustment fee</div>
                  <InfoTooltip
                    content={{
                      heading: null,
                      body: (
                        <>
                          This fee is charged when you change the interest rate within less than 7 days since the last
                          adjustment of your loan. You can thus adjust your interest rate for free once every 7 days.
                        </>
                      ),
                      footerLink: {
                        href: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#can-i-adjust-the-rate",
                        label: "Learn more",
                      },
                    }}
                  />
                </div>
              }
              value={[
                <Amount
                  key="start"
                  fallback="…"
                  value={upfrontFee.data}
                  suffix=" BOLD"
                />,
              ]}
            />
          )}
        </>
      );
  },

  steps: {
    adjustInterestRate: {
      name: () => "Update interest rate",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: loan.branchId,
          interestRate: loan.interestRate[0],
        });

        const { contracts } = getBranch(loan.branchId);
        return ctx.writeContract({
          ...contracts.BorrowerOperations,
          functionName: "adjustTroveInterestRate",
          args: [
            BigInt(loan.troveId),
            loan.interestRate[0],
            upperHint,
            lowerHint,
            maxUint256,
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    setInterestBatchManager: {
      name: () => "Set interest rate delegate",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;

        if (!loan.batchManager) {
          throw new Error("No batch manager provided");
        }

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: loan.branchId,
          interestRate: loan.interestRate[0],
        });

        const { contracts } = getBranch(loan.branchId);
        return ctx.writeContract({
          ...contracts.BorrowerOperations,
          functionName: "setInterestBatchManager",
          args: [
            BigInt(loan.troveId),
            loan.batchManager,
            upperHint,
            lowerHint,
            maxUint256,
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    switchInterestBatchManager: {
      name: () => "Set interest rate delegate",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan, prevLoan } = ctx.request;

        if (!loan.batchManager) {
          throw new Error("No batch manager provided");
        }

        if (!prevLoan.batchManager) {
          throw new Error("No previous batch manager provided");
        }

        const hintsBase = {
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: loan.branchId,
        };

        const [prevHints, newHints] = await Promise.all([
          getTroveOperationHints({
            ...hintsBase,
            interestRate: prevLoan.interestRate[0],
          }),
          getTroveOperationHints({
            ...hintsBase,
            interestRate: loan.interestRate[0],
          }),
        ]);

        const { contracts } = getBranch(loan.branchId);
        return ctx.writeContract({
          ...contracts.BorrowerOperations,
          functionName: "switchBatchManager",
          args: [
            BigInt(loan.troveId),
            prevHints.upperHint,
            prevHints.lowerHint,
            loan.batchManager,
            newHints.upperHint,
            newHints.lowerHint,
            maxUint256,
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    unsetInterestBatchManager: {
      name: () => "Update interest rate",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: loan.branchId,
          interestRate: loan.interestRate[0],
        });

        const { contracts } = getBranch(loan.branchId);
        return ctx.writeContract({
          ...contracts.BorrowerOperations,
          functionName: "removeFromBatch",
          args: [
            BigInt(loan.troveId),
            loan.interestRate[0],
            upperHint,
            lowerHint,
            maxUint256,
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const { loan, prevLoan } = ctx.request;

    if (loan.batchManager) {
      return prevLoan.batchManager
        ? ["switchInterestBatchManager"]
        : ["setInterestBatchManager"];
    }

    const { contracts } = getBranch(loan.branchId);
    const isInBatch = (
      await ctx.readContract({
        ...contracts.BorrowerOperations,
        functionName: "interestBatchManagerOf",
        args: [BigInt(loan.troveId)],
      })
    ) !== ADDRESS_ZERO;

    return isInBatch ? ["unsetInterestBatchManager"] : ["adjustInterestRate"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
