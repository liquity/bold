import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { useSlippageRefund } from "@/src/liquity-leverage";
import { getBranch, getCollToken, usePredictAdjustTroveUpfrontFee } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionLoanCommited } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import type { BranchId, TroveId } from "../types";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "updateLeveragePosition",
  {
    loan: vPositionLoanCommited(),
    prevLoan: vPositionLoanCommited(),
    depositChange: v.nullable(vDnum()),
    debtChange: v.nullable(vDnum()),
    leverageFactorChange: v.tuple([v.nullable(v.number()), v.number()]),

    leverage: v.nullable(
      v.union([
        v.object({
          direction: v.literal("up"),
          flashloanAmount: vDnum(),
          boldAmount: vDnum(),
        }),
        v.object({
          direction: v.literal("down"),
          flashloanAmount: vDnum(),
          minBoldAmount: vDnum(),
        }),
      ]),
    ),
  },
);

export type UpdateLeveragePositionRequest = v.InferOutput<typeof RequestSchema>;

function useUpfrontFeeData(
  branchId: BranchId,
  troveId: TroveId,
  debtChange: dn.Dnum | null,
) {
  const isBorrowing = debtChange && dn.gt(debtChange, DNUM_0);

  const upfrontFee = usePredictAdjustTroveUpfrontFee(
    branchId,
    troveId,
    isBorrowing ? debtChange : DNUM_0,
  );

  return {
    ...upfrontFee,
    data: !upfrontFee.data ? null : {
      debtChangeWithFee: isBorrowing
        ? dn.add(debtChange, upfrontFee.data)
        : debtChange,
      upfrontFee: upfrontFee.data,
    },
  };
}

export const updateLeveragePosition: FlowDeclaration<UpdateLeveragePositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { debtChange, loan, prevLoan } = request;

    const upfrontFeeData = useUpfrontFeeData(loan.branchId, loan.troveId, debtChange);
    const loadingState = match(upfrontFeeData)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    const borrowedWithFee = dn.add(
      loan.borrowed,
      upfrontFeeData.data?.upfrontFee ?? dn.from(0, 18),
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
        displayAllDifferences={false}
      />
    );
  },

  Details({ request, account, steps }) {
    const { loan, depositChange, debtChange, leverageFactorChange } = request;

    const branch = getBranch(loan.branchId);
    const collateral = getCollToken(branch.id);

    const collPrice = usePrice(collateral.symbol);
    const upfrontFeeData = useUpfrontFeeData(loan.branchId, loan.troveId, debtChange);
    const slippageRefund = useSlippageRefund(loan.branchId, account, steps);

    const debtChangeWithFee = upfrontFeeData.data?.debtChangeWithFee;

    return (
      <>
        {depositChange !== null && (
          <TransactionDetailsRow
            label="Deposit change"
            value={[
              <Amount
                key="start"
                fallback="…"
                value={depositChange}
                suffix={` ${collateral.name}`}
                format="2diff"
              />,
              <Amount
                key="end"
                fallback="…"
                value={collPrice.data && dn.mul(dn.abs(depositChange), collPrice.data)}
                prefix="$"
              />,
            ]}
          />
        )}
        <TransactionDetailsRow
          label="Multiply change"
          value={[
            <div key="start">
              {leverageFactorChange[0]
                ? (
                  <>
                    {fmtnum(leverageFactorChange[1] - (leverageFactorChange[0]), {
                      digits: 1,
                      signDisplay: "exceptZero",
                    })}x
                  </>
                )
                : <>N/A</>}
            </div>,
            <div key="end">
              {fmtnum(leverageFactorChange[1], 1)}x
            </div>,
          ]}
        />
        <TransactionDetailsRow
          label="Debt change"
          value={[
            <Amount
              key="start"
              fallback="…"
              value={debtChangeWithFee}
              format="2diff"
              suffix=" JPYDF"
            />,
            upfrontFeeData.data?.upfrontFee
            && dn.gt(upfrontFeeData.data.upfrontFee, 0)
            && (
              <div
                key="end"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <Amount
                  fallback="…"
                  prefix="Incl. "
                  value={upfrontFeeData.data.upfrontFee}
                  suffix=" JPYDF creation fee"
                />
                <InfoTooltip heading="JPYDF creation fee">
                  This fee is charged when you open a new loan or increase your debt. It corresponds to 7 days of
                  average interest for the respective collateral asset.
                </InfoTooltip>
              </div>
            ),
          ]}
        />
        {slippageRefund.data && (
          <TransactionDetailsRow
            label={
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                Slippage refund
                <InfoTooltip heading="Slippage refund">
                  Excess collateral was needed to create the desired exposure and accommodate for slippage. This is the
                  left over amount that has been refunded to your wallet.
                </InfoTooltip>
              </div>
            }
            value={[
              <Amount
                key="start"
                value={slippageRefund.data}
                suffix={` ${collateral.name === "ETH" ? "WETH" : collateral.name}`}
                format="4z"
              />,
              collPrice.data && (
                <Amount
                  key="end"
                  fallback="…"
                  value={dn.mul(slippageRefund.data, collPrice.data)}
                  prefix="$"
                />
              ),
            ]}
          />
        )}
      </>
    );
  },

  steps: {
    approveLst: {
      name: ({ request }) => {
        const token = getCollToken(request.loan.branchId);
        return `Approve ${token?.name ?? ""}`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        if (!ctx.request.depositChange) {
          throw new Error("Invalid step: depositChange is required with approveLst");
        }

        const branch = getBranch(ctx.request.loan.branchId);
        const Zapper = branch.contracts.LeverageLSTZapper;

        return ctx.writeContract({
          ...branch.contracts.CollToken,
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
      name: () => "Deposit",
      Status: TransactionStatus,

      async commit(ctx) {
        if (!ctx.request.depositChange) {
          throw new Error("Invalid step: depositChange is required with increaseDeposit");
        }

        const branch = getBranch(ctx.request.loan.branchId);

        // add ETH
        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "addCollWithRawETH",
            args: [BigInt(ctx.request.loan.troveId)],
            value: ctx.request.depositChange[0],
          });
        }

        // add LST
        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "addColl",
          args: [BigInt(ctx.request.loan.troveId), ctx.request.depositChange[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    decreaseDeposit: {
      name: () => "Withdraw",
      Status: TransactionStatus,

      async commit(ctx) {
        if (!ctx.request.depositChange) {
          throw new Error("Invalid step: depositChange is required with decreaseDeposit");
        }

        const branch = getBranch(ctx.request.loan.branchId);

        const args = [
          BigInt(ctx.request.loan.troveId),
          ctx.request.depositChange[0] * -1n,
        ] as const;

        // withdraw ETH
        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "withdrawCollToRawETH",
            args,
          });
        }

        // withdraw LST
        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "withdrawColl",
          args,
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    leverUpTrove: {
      name: () => "Multiply",
      Status: TransactionStatus,

      async commit(ctx) {
        if (ctx.request.leverage?.direction !== "up") {
          throw new Error("Invalid step: leverUpTrove");
        }

        const branch = getBranch(ctx.request.loan.branchId);

        const args = [{
          troveId: BigInt(ctx.request.loan.troveId),
          flashLoanAmount: dn.from(ctx.request.leverage.flashloanAmount, 18)[0],
          boldAmount: dn.from(ctx.request.leverage.boldAmount, 18)[0],
          maxUpfrontFee: MAX_UPFRONT_FEE,
        }] as const;

        // leverage up ETH trove
        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "leverUpTrove",
            args,
          });
        }

        // leverage up LST trove
        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "leverUpTrove",
          args,
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    leverDownTrove: {
      name: () => "Multiply",
      Status: TransactionStatus,

      async commit(ctx) {
        if (ctx.request.leverage?.direction !== "down") {
          throw new Error("Invalid step: leverDownTrove");
        }

        const branch = getBranch(ctx.request.loan.branchId);

        const args = [{
          troveId: BigInt(ctx.request.loan.troveId),
          flashLoanAmount: dn.from(ctx.request.leverage.flashloanAmount, 18)[0],
          minBoldAmount: dn.from(ctx.request.leverage.minBoldAmount)[0],
        }] as const;

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "leverDownTrove",
            args,
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "leverDownTrove",
          args,
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const { depositChange, leverage, loan } = ctx.request;

    const steps: string[] = [];
    const branch = getBranch(loan.branchId);

    // only check approval for non-ETH collaterals
    if (branch.symbol !== "ETH" && depositChange && dn.gt(depositChange, 0)) {
      const { LeverageLSTZapper, CollToken } = branch.contracts;
      const allowance = dnum18(
        await ctx.readContract({
          ...CollToken,
          functionName: "allowance",
          args: [ctx.account ?? ADDRESS_ZERO, LeverageLSTZapper.address],
        }),
      );

      if (dn.lt(allowance, depositChange)) {
        steps.push("approveLst");
      }
    }

    if (leverage?.direction === "down") {
      steps.push("leverDownTrove");
    }

    if (depositChange) {
      steps.push(dn.gt(depositChange, 0) ? "increaseDeposit" : "decreaseDeposit");
    }

    if (leverage?.direction === "up") {
      steps.push("leverUpTrove");
    }

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
