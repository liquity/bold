import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import {
  getCollToken,
  usePredictAdjustTroveUpfrontFee,
} from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionLoanCommited } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import {
  createRequestSchema,
  verifyTransaction,
  verifyTroveUpdate,
} from "./shared";

const RequestSchema = createRequestSchema("updateBorrowPosition", {
  maxUpfrontFee: vDnum(),
  prevLoan: vPositionLoanCommited(),
  loan: vPositionLoanCommited(),
});

export type UpdateBorrowPositionRequest = v.InferOutput<typeof RequestSchema>;

export const updateBorrowPosition: FlowDeclaration<UpdateBorrowPositionRequest> =
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
          leverageMode={false}
          loadingState={loadingState}
          loan={{ ...loan, borrowed: borrowedWithFee }}
          prevLoan={prevLoan}
          onRetry={() => {}}
          txPreviewMode
        />
      );
    },

    Details({ request }) {
      const { loan, prevLoan } = request;

      const collChange = getCollChange(loan, prevLoan);

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
          {!dn.eq(collChange, 0) && (
            <TransactionDetailsRow
              label={dn.gt(collChange, 0) ? "You deposit" : "You withdraw"}
              value={[
                <div
                  key='start'
                  title={`${fmtnum(dn.abs(collChange), "full")} ${
                    collateral.name
                  }`}
                  style={{
                    color: dn.eq(collChange, 0n)
                      ? "var(--colors-content-alt2)"
                      : undefined,
                  }}
                >
                  {fmtnum(dn.abs(collChange))} {collateral.name}
                </div>,
                <Amount
                  key='end'
                  fallback='…'
                  prefix='$'
                  value={
                    collPrice.data && dn.mul(dn.abs(collChange), collPrice.data)
                  }
                />,
              ]}
            />
          )}
          {debtChangeWithFee && !dn.eq(debtChangeWithFee, 0n) && (
            <TransactionDetailsRow
              label={isBorrowing ? "You borrow" : "You repay"}
              value={[
                <Amount
                  key='start'
                  fallback='…'
                  value={debtChangeWithFee && dn.abs(debtChangeWithFee)}
                  suffix=' USND'
                />,
                upfrontFeeData.data?.upfrontFee &&
                  dn.gt(upfrontFeeData.data.upfrontFee, 0n) && (
                    <Amount
                      key='end'
                      fallback='…'
                      prefix='Incl. '
                      value={upfrontFeeData.data.upfrontFee}
                      suffix=' USND upfront interest fee'
                    />
                  ),
              ]}
            />
          )}
        </>
      );
    },

    steps: {
      approveBold: {
        name: () => "Approve USND",
        Status: (props) => (
          <TransactionStatus {...props} approval='approve-only' />
        ),
        async commit(ctx) {
          const debtChange = getDebtChange(
            ctx.request.loan,
            ctx.request.prevLoan
          );
          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              "Invalid collateral index: " + ctx.request.loan.collIndex
            );
          }
          const Controller =
            collateral.symbol === "ETH"
              ? collateral.contracts.LeverageWETHZapper
              : collateral.contracts.LeverageLSTZapper;

          return ctx.writeContract({
            ...ctx.contracts.BoldToken,
            functionName: "approve",
            args: [
              Controller.address,
              ctx.preferredApproveMethod === "approve-infinite"
                ? maxUint256 // infinite approval
                : dn.abs(debtChange)[0], // exact amount
            ],
          });
        },
        async verify(ctx, hash) {
          await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
        },
      },

      approveColl: {
        name: ({ contracts, request }) => {
          const coll = contracts.collaterals[request.loan.collIndex];
          if (!coll) {
            throw new Error(
              "Invalid collateral index: " + request.loan.collIndex
            );
          }
          return `Approve ${coll.symbol}`;
        },
        Status: (props) => (
          <TransactionStatus {...props} approval='approve-only' />
        ),
        async commit(ctx) {
          const collChange = getCollChange(
            ctx.request.loan,
            ctx.request.prevLoan
          );

          const collateral =
            ctx.contracts.collaterals[ctx.request.loan.collIndex];
          if (!collateral) {
            throw new Error(
              "Invalid collateral index: " + ctx.request.loan.collIndex
            );
          }

          const Controller = collateral.contracts.LeverageLSTZapper;

          return ctx.writeContract({
            ...collateral.contracts.CollToken,
            functionName: "approve",
            args: [
              Controller.address,
              ctx.preferredApproveMethod === "approve-infinite"
                ? maxUint256 // infinite approval
                : dn.abs(collChange)[0], // exact amount
            ],
          });
        },
        async verify(ctx, hash) {
          await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
        },
      },

      // update both collateral and debt
      adjustTrove: {
        name: () => "Update Position",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan, maxUpfrontFee } = ctx.request;
          const collChange = getCollChange(loan, ctx.request.prevLoan);
          const debtChange = getDebtChange(loan, ctx.request.prevLoan);
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }
          if (collateral.symbol === "ETH") {
            throw new Error("ETH collateral not supported for adjustTrove");
          }

          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "adjustTrove",
            args: [
              BigInt(loan.troveId),
              dn.abs(collChange)[0],
              !dn.lt(collChange, 0n),
              dn.abs(debtChange)[0],
              !dn.lt(debtChange, 0n),
              maxUpfrontFee[0],
            ],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      depositBold: {
        name: () => "Repay USND",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan } = ctx.request;
          const debtChange = getDebtChange(loan, ctx.request.prevLoan);
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "repayBold",
              args: [BigInt(loan.troveId), dn.abs(debtChange)[0]],
            });
          }

          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "repayBold",
            args: [BigInt(loan.troveId), dn.abs(debtChange)[0]],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      depositColl: {
        name: () => "Deposit Collateral",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan } = ctx.request;
          const collChange = getCollChange(loan, ctx.request.prevLoan);
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "addCollWithRawETH",
              args: [BigInt(loan.troveId)],
              value: dn.abs(collChange)[0],
            });
          }

          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "addColl",
            args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      withdrawBold: {
        name: () => "Borrow USND",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan, maxUpfrontFee } = ctx.request;
          const debtChange = getDebtChange(loan, ctx.request.prevLoan);
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "withdrawBold",
              args: [
                BigInt(loan.troveId),
                dn.abs(debtChange)[0],
                maxUpfrontFee[0],
              ],
            });
          }

          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "withdrawBold",
            args: [
              BigInt(loan.troveId),
              dn.abs(debtChange)[0],
              maxUpfrontFee[0],
            ],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },

      withdrawColl: {
        name: () => "Withdraw Collateral",
        Status: TransactionStatus,

        async commit(ctx) {
          const { loan } = ctx.request;
          const collChange = getCollChange(loan, ctx.request.prevLoan);
          const collateral = ctx.contracts.collaterals[loan.collIndex];
          if (!collateral) {
            throw new Error("Invalid collateral index: " + loan.collIndex);
          }

          if (collateral.symbol === "ETH") {
            return ctx.writeContract({
              ...collateral.contracts.LeverageWETHZapper,
              functionName: "withdrawCollToRawETH",
              args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
            });
          }

          return ctx.writeContract({
            ...collateral.contracts.LeverageLSTZapper,
            functionName: "withdrawColl",
            args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
          });
        },

        async verify(ctx, hash) {
          await verifyTroveUpdate(ctx.wagmiConfig, hash, ctx.request.loan);
        },
      },
    },

    async getSteps(ctx) {
      if (!ctx.account) {
        throw new Error("Account address is required");
      }

      const debtChange = getDebtChange(ctx.request.loan, ctx.request.prevLoan);
      const collChange = getCollChange(ctx.request.loan, ctx.request.prevLoan);
      const coll = ctx.contracts.collaterals[ctx.request.loan.collIndex];
      if (!coll) {
        throw new Error(
          "Invalid collateral index: " + ctx.request.loan.collIndex
        );
      }

      const Controller =
        coll.symbol === "ETH"
          ? coll.contracts.LeverageWETHZapper
          : coll.contracts.LeverageLSTZapper;

      const isBoldApproved =
        !dn.lt(debtChange, 0) ||
        !dn.gt(dn.abs(debtChange), [
          (await ctx.readContract({
            ...ctx.contracts.BoldToken,
            functionName: "allowance",
            args: [ctx.account, Controller.address],
          })) ?? 0n,
          18,
        ]);

      // Collateral token needs to be approved if collChange > 0 and collToken != "ETH" (no LeverageWETHZapper)
      const isCollApproved =
        coll.symbol === "ETH" ||
        !dn.gt(collChange, 0) ||
        !dn.gt(collChange, [
          (await ctx.readContract({
            ...coll.contracts.CollToken,
            functionName: "allowance",
            args: [ctx.account, Controller.address],
          })) ?? 0n,
          18,
        ]);

      const steps: string[] = [];

      if (!isBoldApproved) steps.push("approveBold");
      if (!isCollApproved) steps.push("approveColl");

      return steps.concat(getFinalSteps(ctx.request, coll.symbol));
    },

    parseRequest(request) {
      return v.parse(RequestSchema, request);
    },
  };

function getDebtChange(
  loan: UpdateBorrowPositionRequest["loan"],
  prevLoan: UpdateBorrowPositionRequest["prevLoan"]
) {
  return dn.sub(loan.borrowed, prevLoan.borrowed);
}

function getCollChange(
  loan: UpdateBorrowPositionRequest["loan"],
  prevLoan: UpdateBorrowPositionRequest["prevLoan"]
) {
  return dn.sub(loan.deposit, prevLoan.deposit);
}

function getFinalSteps(
  request: UpdateBorrowPositionRequest,
  collSymbol: string
): (
  | "adjustTrove"
  | "depositBold"
  | "depositColl"
  | "withdrawBold"
  | "withdrawColl"
)[] {
  const collChange = getCollChange(request.loan, request.prevLoan);
  const debtChange = getDebtChange(request.loan, request.prevLoan);

  // both coll and debt change => adjust trove
  if (!dn.eq(collChange, 0) && !dn.eq(debtChange, 0)) {
    if (collSymbol === "ETH") {
      return dn.gt(collChange, 0)
        ? ["depositColl", dn.gt(debtChange, 0) ? "withdrawBold" : "depositBold"]
        : [
            dn.gt(debtChange, 0) ? "withdrawBold" : "depositBold",
            "withdrawColl",
          ];
    }
    return ["adjustTrove"];
  }

  // coll increases => deposit
  if (dn.gt(collChange, 0)) return ["depositColl"];

  // coll decreases => withdraw
  if (dn.lt(collChange, 0)) return ["withdrawColl"];

  // debt increases => withdraw USND (borrow)
  if (dn.gt(debtChange, 0)) return ["withdrawBold"];

  // debt decreases => deposit USND (repay)
  if (dn.lt(debtChange, 0)) return ["depositBold"];

  throw new Error("Invalid request");
}

function useUpfrontFeeData(
  loan: UpdateBorrowPositionRequest["loan"],
  prevLoan: UpdateBorrowPositionRequest["prevLoan"]
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
