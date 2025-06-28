import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import {
  getLeverDownTroveParams,
  getLeverUpTroveParams,
} from "@/src/liquity-leverage";
import {
  getCollToken,
  usePredictAdjustTroveUpfrontFee,
} from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionLoanCommited } from "@/src/valibot-utils";
import { ADDRESS_ZERO } from "@liquity2/uikit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import {
  createRequestSchema,
  verifyTransaction,
  verifyTroveUpdate,
} from "./shared";

const RequestSchema = createRequestSchema("updateLeveragePosition", {
  depositChange: v.union([v.null(), vDnum()]),
  // set to null to indicate no multiply change
  leverageFactorChange: v.union([
    v.null(),
    v.tuple([
      v.number(), // prev multiply
      v.number(), // new multiply
    ]),
  ]),
  prevLoan: vPositionLoanCommited(),
  loan: vPositionLoanCommited(),
});

export type UpdateLeveragePositionRequest = v.InferOutput<typeof RequestSchema>;

function useUpfrontFeeData(
  loan: UpdateLeveragePositionRequest["loan"],
  prevLoan: UpdateLeveragePositionRequest["prevLoan"]
) {
  const debtChange = dn.sub(loan.borrowed, prevLoan.borrowed);
  const isBorrowing = dn.gt(debtChange, 0);

  const upfrontFee = usePredictAdjustTroveUpfrontFee(
    loan.collIndex,
    loan.troveId,
    isBorrowing ? debtChange : [0n, 18]
  );

  return {
    ...upfrontFee,
    data: !upfrontFee.data
      ? null
      : {
          isBorrowing,
          debtChangeWithFee: isBorrowing
            ? dn.add(debtChange, upfrontFee.data)
            : debtChange,
          upfrontFee: upfrontFee.data,
        },
  };
}

export const updateLeveragePosition: FlowDeclaration<UpdateLeveragePositionRequest> =
  {
    title: "Review & Send Transaction",

    Summary({ request }) {
      const { loan, prevLoan } = request;
      const collateral = getCollToken(loan.collIndex);
      if (!collateral) {
        throw new Error(`Invalid collateral index: ${loan.collIndex}`);
      }

      const upfrontFeeData = useUpfrontFeeData(loan, prevLoan);
      const loadingState = match(upfrontFeeData)
        .returnType<LoadingState>()
        .with({ status: "error" }, () => "error")
        .with({ status: "pending" }, () => "loading")
        .with({ data: null }, () => "not-found")
        .with({ data: P.nonNullable }, () => "success")
        .otherwise(() => "error");

      const borrowedWithFee = dn.add(
        loan.borrowed,
        upfrontFeeData.data?.upfrontFee ?? dn.from(0, 18)
      );

      return (
        <LoanCard
          leverageMode={true}
          loadingState={loadingState}
          loan={{ ...loan, borrowed: borrowedWithFee }}
          prevLoan={prevLoan}
          onRetry={() => {
            upfrontFeeData.refetch();
          }}
          txPreviewMode
        />
      );
    },

    Details({ request }) {
      const { loan, prevLoan, depositChange, leverageFactorChange } = request;

      const collateral = getCollToken(loan.collIndex);
      if (!collateral) {
        throw new Error(`Invalid collateral index: ${loan.collIndex}`);
      }

      const collPrice = usePrice(collateral.symbol);
      const upfrontFeeData = useUpfrontFeeData(loan, prevLoan);

      const debtChangeWithFee = upfrontFeeData.data?.debtChangeWithFee;
      const isBorrowing = upfrontFeeData.data?.isBorrowing;

      return (
        <>
          {depositChange !== null && (
            <TransactionDetailsRow
              label='Deposit change'
              value={[
                <Amount
                  key='start'
                  fallback='…'
                  value={depositChange}
                  suffix={` ${collateral.name}`}
                  format='2diff'
                />,
                <Amount
                  key='end'
                  fallback='…'
                  value={
                    collPrice.data && dn.mul(depositChange, collPrice.data)
                  }
                  prefix='$'
                />,
              ]}
            />
          )}
          {leverageFactorChange && (
            <TransactionDetailsRow
              label={isBorrowing ? "Multiply increase" : "Multiply decrease"}
              value={[
                <div key='start'>
                  {fmtnum(leverageFactorChange[1] - leverageFactorChange[0], {
                    digits: 2,
                    signDisplay: "exceptZero",
                  })}
                  x
                </div>,
                <div key='end'>
                  {fmtnum(leverageFactorChange[1], 2)}x multiply
                </div>,
              ]}
            />
          )}
          <TransactionDetailsRow
            label={isBorrowing ? "Additional debt" : "Debt reduction"}
            value={[
              <Amount
                key='start'
                fallback='…'
                value={debtChangeWithFee}
                suffix=' USND'
              />,
              upfrontFeeData.data?.upfrontFee &&
                dn.gt(upfrontFeeData.data.upfrontFee, 0) && (
                  <Amount
                    key='end'
                    fallback='…'
                    prefix='Incl. '
                    value={upfrontFeeData.data.upfrontFee}
                    suffix=' USND interest rate adjustment fee'
                  />
                ),
            ]}
          />
        </>
      );
    },

    steps: {
      approveLst: {
        name: ({ request }) => {
          const token = getCollToken(request.loan.collIndex);
          return `Approve ${token?.name ?? ""}`;
        },
        Status: (props) => (
          <TransactionStatus {...props} approval='approve-only' />
        ),
        async commit(ctx) {
          if (!ctx.request.depositChange) {
            throw new Error(
              "Invalid step: depositChange is required with approveLst"
            );
          }

          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              `Invalid collateral index: ${ctx.request.loan.collIndex}`
            );
          }
          const Zapper = collateral.contracts.LeverageLSTZapper;

          return ctx.writeContract({
            ...collateral.contracts.CollToken,
            functionName: "approve",
            args: [
              Zapper.address,
              ctx.preferredApproveMethod === "approve-infinite"
                ? maxUint256 // infinite approval
                : ctx.request.depositChange[0], // exact amount
            ],
          });
        },
        async verify(ctx, hash) {
          await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
        },
      },

      increaseDeposit: {
        name: () => "Increase Deposit",
        Status: TransactionStatus,

        async commit(ctx) {
          if (!ctx.request.depositChange) {
            throw new Error(
              "Invalid step: depositChange is required with increaseDeposit"
            );
          }

          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              `Invalid collateral index: ${ctx.request.loan.collIndex}`
            );
          }

          // add ETH
          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "addCollWithRawETH",
              args: [BigInt(ctx.request.loan.troveId)],
              value: ctx.request.depositChange[0],
            });
          }

          // add LST
          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "addColl",
            args: [
              BigInt(ctx.request.loan.troveId),
              ctx.request.depositChange[0],
            ],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      decreaseDeposit: {
        name: () => "Decrease Deposit",
        Status: TransactionStatus,

        async commit(ctx) {
          if (!ctx.request.depositChange) {
            throw new Error(
              "Invalid step: depositChange is required with decreaseDeposit"
            );
          }

          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              `Invalid collateral index: ${ctx.request.loan.collIndex}`
            );
          }

          const args = [
            BigInt(ctx.request.loan.troveId),
            ctx.request.depositChange[0] * -1n,
          ] as const;

          // withdraw ETH
          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "withdrawCollToRawETH",
              args,
            });
          }

          // withdraw LST
          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "withdrawColl",
            args,
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      leverUpTrove: {
        name: () => "Increase Multiplier",
        Status: TransactionStatus,

        async commit(ctx) {
          if (!ctx.request.leverageFactorChange) {
            throw new Error(
              "Invalid step: leverageFactorChange is required with leverUpTrove"
            );
          }

          const params = await getLeverUpTroveParams(
            ctx.request.loan.collIndex,
            ctx.request.loan.troveId,
            ctx.request.leverageFactorChange[1],
            ctx.wagmiConfig
          );
          if (!params) {
            throw new Error("Couldn't fetch trove lever up params");
          }

          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              `Invalid collateral index: ${ctx.request.loan.collIndex}`
            );
          }

          const args = [
            {
              troveId: BigInt(ctx.request.loan.troveId),
              flashLoanAmount: params.flashLoanAmount,
              boldAmount: params.effectiveBoldAmount,
              maxUpfrontFee: MAX_UPFRONT_FEE,
            },
          ] as const;

          // leverage up ETH trove
          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "leverUpTrove",
              args,
            });
          }

          // leverage up LST trove
          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "leverUpTrove",
            args,
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      leverDownTrove: {
        name: () => "Decrease Multiplier",
        Status: TransactionStatus,

        async commit(ctx) {
          if (!ctx.request.leverageFactorChange) {
            throw new Error(
              "Invalid step: leverageFactorChange is required with leverDownTrove"
            );
          }

          const params = await getLeverDownTroveParams(
            ctx.request.loan.collIndex,
            ctx.request.loan.troveId,
            ctx.request.leverageFactorChange[1],
            ctx.wagmiConfig
          );
          if (!params) {
            throw new Error("Couldn't fetch trove lever down params");
          }

          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              `Invalid collateral index: ${ctx.request.loan.collIndex}`
            );
          }

          const args = [
            {
              troveId: BigInt(ctx.request.loan.troveId),
              flashLoanAmount: params.flashLoanAmount,
              minBoldAmount: params.minBoldAmount,
            },
          ] as const;

          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "leverDownTrove",
              args,
            });
          }

          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "leverDownTrove",
            args,
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },
    },

    async getSteps(ctx) {
      const { depositChange, leverageFactorChange, loan } = ctx.request;

      const collateral = ctx.contracts.collaterals[loan.collIndex];
      if (!collateral) {
        throw new Error(`Invalid collateral index: ${loan.collIndex}`);
      }

      const steps: string[] = [];

      // only check approval for non-ETH collaterals
      if (
        collateral.symbol !== "ETH" &&
        depositChange &&
        dn.gt(depositChange, 0)
      ) {
        const { LeverageLSTZapper, CollToken } = collateral.contracts;
        const allowance = dnum18(
          await ctx.readContract({
            ...CollToken,
            functionName: "allowance",
            args: [ctx.account ?? ADDRESS_ZERO, LeverageLSTZapper.address],
          })
        );

        if (dn.lt(allowance, depositChange)) {
          steps.push("approveLst");
        }
      }

      if (depositChange) {
        steps.push(
          dn.gt(depositChange, 0) ? "increaseDeposit" : "decreaseDeposit"
        );
      }

      if (leverageFactorChange) {
        const [oldLeverage, newLeverage] = leverageFactorChange;
        steps.push(
          newLeverage > oldLeverage ? "leverUpTrove" : "leverDownTrove"
        );
      }

      return steps;
    },

    parseRequest(request) {
      return v.parse(RequestSchema, request);
    },
  };
