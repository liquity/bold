import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import {
  MAX_ANNUAL_INTEREST_RATE,
  MIN_ANNUAL_INTEREST_RATE,
} from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { usePredictAdjustInterestRateUpfrontFee } from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vPositionLoanCommited } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { createRequestSchema, verifyTroveUpdate } from "./shared";

const RequestSchema = createRequestSchema("updateLoanInterestRate", {
  prevLoan: vPositionLoanCommited(),
  loan: vPositionLoanCommited(),
});

export type UpdateLoanInterestRateRequest = v.InferOutput<typeof RequestSchema>;

export const updateLoanInterestRate: FlowDeclaration<UpdateLoanInterestRateRequest> =
  {
    title: "Review & Confirm",

    Summary({ request }) {
      const { loan, prevLoan } = request;
      const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
        loan.collIndex,
        loan.troveId,
        loan.batchManager ?? loan.interestRate,
        prevLoan.batchManager !== null
      );

      const borrowedWithFee =
        upfrontFee.data && dn.add(loan.borrowed, upfrontFee.data);
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

    Details({ request }) {
      const { loan, prevLoan } = request;

      const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
        loan.collIndex,
        loan.troveId,
        loan.batchManager ?? loan.interestRate,
        prevLoan.batchManager !== null
      );

      const yearlyBoldInterest = dn.mul(loan.borrowed, loan.interestRate);

      return loan.batchManager ? (
        <TransactionDetailsRow
          label='Interest rate delegate'
          value={[
            <AccountButton key='start' address={loan.batchManager} />,
            <div key='end'>
              {fmtnum(loan.interestRate, "pctfull")}% (
              {fmtnum(yearlyBoldInterest, {
                digits: 4,
                dust: false,
                prefix: "~",
              })}{" "}
              USND per year)
            </div>,
          ]}
        />
      ) : (
        <>
          <TransactionDetailsRow
            label='New interest rate'
            value={[
              <div key='start'>{fmtnum(loan.interestRate, "pctfull")}%</div>,
              <div
                key='end'
                title={`${fmtnum(yearlyBoldInterest, "full")} USND per year`}
              >
                {fmtnum(yearlyBoldInterest, {
                  digits: 4,
                  dust: false,
                  prefix: "~",
                })}{" "}
                USND per year
              </div>,
            ]}
          />
          {prevLoan.batchManager && (
            <TransactionDetailsRow
              label='Remove interest rate delegate'
              value={[
                <div
                  key='start'
                  className={css({
                    textDecoration: "line-through",
                  })}
                >
                  <AccountButton address={prevLoan.batchManager} />
                </div>,
                <div
                  key='end'
                  className={css({
                    textDecoration: "line-through",
                  })}
                >
                  {fmtnum(prevLoan.interestRate, "pctfull")}% (
                  {fmtnum(dn.mul(prevLoan.borrowed, prevLoan.interestRate), {
                    digits: 4,
                    dust: false,
                    prefix: "~",
                  })}{" "}
                  USND per year)
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
                          This fee is charged when you change the interest rate
                          within less than 7 days since the last adjustment of
                          your loan. You can thus adjust your interest rate for
                          free once every 7 days.
                        </>
                      ),
                      footerLink: {
                        href: "https://docs.nerite.org/docs/user-docs/borrowing-and-liquidations#can-i-adjust-the-rate",
                        label: "Learn more",
                      },
                    }}
                  />
                </div>
              }
              value={[
                <Amount
                  key='start'
                  fallback='…'
                  value={upfrontFee.data}
                  suffix=' USND'
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

          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          const { BorrowerOperations } = collateral.contracts;

          return ctx.writeContract({
            ...BorrowerOperations,
            functionName: "adjustTroveInterestRate",
            args: [
              BigInt(loan.troveId),
              loan.interestRate[0],
              0n,
              0n,
              maxUint256,
            ],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      setInterestBatchManager: {
        name: () => "Set interest rate delegate",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan } = ctx.request;
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          const { BorrowerOperations } = collateral.contracts;

          if (!loan.batchManager) {
            throw new Error("No batch manager provided");
          }

          return ctx.writeContract({
            ...BorrowerOperations,
            functionName: "setInterestBatchManager",
            args: [
              BigInt(loan.troveId),
              loan.batchManager,
              MIN_ANNUAL_INTEREST_RATE[0],
              MAX_ANNUAL_INTEREST_RATE[0],
              maxUint256,
            ],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      unsetInterestBatchManager: {
        name: () => "Update interest rate",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan } = ctx.request;
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          const { BorrowerOperations } = collateral.contracts;

          return ctx.writeContract({
            ...BorrowerOperations,
            functionName: "removeFromBatch",
            args: [
              BigInt(loan.troveId),
              loan.interestRate[0],
              0n,
              0n,
              maxUint256,
            ],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },
    },

    async getSteps(ctx) {
      const loan = ctx.request.loan;
      const collateral = ctx.contracts.collaterals[loan.collIndex];
      if (!collateral) {
        throw new Error("Invalid collateral index: " + loan.collIndex);
      }

      if (loan.batchManager) {
        return ["setInterestBatchManager"];
      }

      const isInBatch =
        (await ctx.readContract({
          ...collateral.contracts.BorrowerOperations,
          functionName: "interestBatchManagerOf",
          args: [BigInt(loan.troveId)],
        })) !== ADDRESS_ZERO;

      return isInBatch ? ["unsetInterestBatchManager"] : ["adjustInterestRate"];
    },

    parseRequest(request) {
      return v.parse(RequestSchema, request);
    },
  };
