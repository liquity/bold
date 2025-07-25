import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import { getBranch, getCollToken, getTroveOperationHints, usePredictAdjustTroveUpfrontFee } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionLoanCommited } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "updateBorrowPosition",
  {
    maxUpfrontFee: vDnum(),
    prevLoan: vPositionLoanCommited(),
    loan: vPositionLoanCommited(),
  },
);

export type UpdateBorrowPositionRequest = v.InferOutput<typeof RequestSchema>;

export const updateBorrowPosition: FlowDeclaration<UpdateBorrowPositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { loan, prevLoan } = request;
    const collateral = getCollToken(loan.branchId);
    if (!collateral) {
      throw new Error(`Invalid branch: ${loan.branchId}`);
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
      upfrontFeeData.data?.upfrontFee ?? dn.from(0, 18),
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
    const collateral = getCollToken(loan.branchId);

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
                key="start"
                title={`${fmtnum(dn.abs(collChange), "full")} ${collateral.name}`}
                style={{
                  color: dn.eq(collChange, 0n)
                    ? "var(--colors-content-alt2)"
                    : undefined,
                }}
              >
                {fmtnum(dn.abs(collChange))} {collateral.name}
              </div>,
              <Amount
                key="end"
                fallback="…"
                prefix="$"
                value={collPrice.data && dn.mul(dn.abs(collChange), collPrice.data)}
              />,
            ]}
          />
        )}
        {debtChangeWithFee && !dn.eq(debtChangeWithFee, 0n) && (
          <TransactionDetailsRow
            label={isBorrowing ? "Loan increase" : "Loan decrease"}
            value={[
              <Amount
                key="start"
                fallback="…"
                value={debtChangeWithFee && dn.abs(debtChangeWithFee)}
                suffix=" BOLD"
              />,
              upfrontFeeData.data?.upfrontFee && dn.gt(upfrontFeeData.data.upfrontFee, 0n) && (
                <Amount
                  key="end"
                  fallback="…"
                  prefix="Incl. "
                  value={upfrontFeeData.data.upfrontFee}
                  suffix=" BOLD interest rate adjustment fee"
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
      name: () => "Approve BOLD",
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        const debtChange = getDebtChange(ctx.request.loan, ctx.request.prevLoan);

        const branch = getBranch(ctx.request.loan.branchId);

        const Controller = branch.symbol === "ETH"
          ? branch.contracts.LeverageWETHZapper
          : branch.contracts.LeverageLSTZapper;

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
      name: ({ request }) => {
        const branch = getBranch(request.loan.branchId);
        return `Approve ${branch.symbol}`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        const collChange = getCollChange(ctx.request.loan, ctx.request.prevLoan);

        const branch = getBranch(ctx.request.loan.branchId);

        const Controller = branch.contracts.LeverageLSTZapper;

        return ctx.writeContract({
          ...branch.contracts.CollToken,
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

        const branch = getBranch(loan.branchId);

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "adjustTroveWithRawETH",
            args: [
              BigInt(loan.troveId),
              dn.abs(collChange)[0],
              dn.gt(collChange, 0n),
              dn.abs(debtChange)[0],
              dn.gt(debtChange, 0n),
              maxUpfrontFee[0],
            ],
            value: dn.gt(collChange, 0n) ? collChange[0] : 0n,
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "adjustTrove",
          args: [
            BigInt(loan.troveId),
            dn.abs(collChange)[0],
            dn.gt(collChange, 0n),
            dn.abs(debtChange)[0],
            dn.gt(debtChange, 0n),
            maxUpfrontFee[0],
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    // update both collateral and debt on a zombie Trove (needs hints)
    adjustZombieTrove: {
      name: ({ request }) => {
        const collChange = getCollChange(request.loan, request.prevLoan);
        const debtChange = getDebtChange(request.loan, request.prevLoan);

        if (!dn.eq(collChange, 0) && !dn.eq(debtChange, 0)) return "Update Position";
        if (dn.gt(collChange, 0)) return "Deposit Collateral";
        if (dn.lt(collChange, 0)) return "Withdraw Collateral";
        if (dn.gt(debtChange, 0)) return "Borrow BOLD";
        if (dn.lt(debtChange, 0)) return "Repay BOLD";

        throw new Error("Invalid request");
      },

      Status: TransactionStatus,

      async commit(ctx) {
        const { loan, maxUpfrontFee } = ctx.request;
        const collChange = getCollChange(loan, ctx.request.prevLoan);
        const debtChange = getDebtChange(loan, ctx.request.prevLoan);

        const branch = getBranch(loan.branchId);

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: loan.branchId,
          interestRate: loan.interestRate[0],
        });

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "adjustZombieTroveWithRawETH",
            args: [
              BigInt(loan.troveId),
              dn.abs(collChange)[0],
              dn.gt(collChange, 0n),
              dn.abs(debtChange)[0],
              dn.gt(debtChange, 0n),
              upperHint,
              lowerHint,
              maxUpfrontFee[0],
            ],
            value: dn.gt(collChange, 0n) ? collChange[0] : 0n,
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "adjustZombieTrove",
          args: [
            BigInt(loan.troveId),
            dn.abs(collChange)[0],
            dn.gt(collChange, 0n),
            dn.abs(debtChange)[0],
            dn.gt(debtChange, 0n),
            upperHint,
            lowerHint,
            maxUpfrontFee[0],
          ],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    depositBold: {
      name: () => "Repay BOLD",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;
        const debtChange = getDebtChange(loan, ctx.request.prevLoan);

        const branch = getBranch(loan.branchId);

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "repayBold",
            args: [BigInt(loan.troveId), dn.abs(debtChange)[0]],
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "repayBold",
          args: [BigInt(loan.troveId), dn.abs(debtChange)[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    depositColl: {
      name: () => "Deposit Collateral",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;
        const collChange = getCollChange(loan, ctx.request.prevLoan);

        const branch = getBranch(loan.branchId);

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "addCollWithRawETH",
            args: [BigInt(loan.troveId)],
            value: dn.abs(collChange)[0],
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "addColl",
          args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    withdrawBold: {
      name: () => "Borrow BOLD",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan, maxUpfrontFee } = ctx.request;
        const debtChange = getDebtChange(loan, ctx.request.prevLoan);
        const branch = getBranch(loan.branchId);

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "withdrawBold",
            args: [BigInt(loan.troveId), dn.abs(debtChange)[0], maxUpfrontFee[0]],
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "withdrawBold",
          args: [BigInt(loan.troveId), dn.abs(debtChange)[0], maxUpfrontFee[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    withdrawColl: {
      name: () => "Withdraw Collateral",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;
        const collChange = getCollChange(loan, ctx.request.prevLoan);
        const branch = getBranch(loan.branchId);

        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...branch.contracts.LeverageWETHZapper,
            functionName: "withdrawCollToRawETH",
            args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
          });
        }

        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "withdrawColl",
          args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const debtChange = getDebtChange(ctx.request.loan, ctx.request.prevLoan);
    const collChange = getCollChange(ctx.request.loan, ctx.request.prevLoan);

    const branch = getBranch(ctx.request.loan.branchId);

    const Controller = branch.symbol === "ETH"
      ? branch.contracts.LeverageWETHZapper
      : branch.contracts.LeverageLSTZapper;

    const isBoldApproved = !dn.lt(debtChange, 0) || !dn.gt(
      dn.abs(debtChange),
      [
        (await ctx.readContract({
          ...ctx.contracts.BoldToken,
          functionName: "allowance",
          args: [ctx.account, Controller.address],
        })) ?? 0n,
        18,
      ],
    );

    // Collateral token needs to be approved if collChange > 0 and collToken != "ETH" (no LeverageWETHZapper)
    const isCollApproved = branch.symbol === "ETH" || !dn.gt(collChange, 0) || !dn.gt(collChange, [
      (await ctx.readContract({
        ...branch.contracts.CollToken,
        functionName: "allowance",
        args: [ctx.account, Controller.address],
      })) ?? 0n,
      18,
    ]);

    const steps: string[] = [];

    if (!isBoldApproved) steps.push("approveBold");
    if (!isCollApproved) steps.push("approveColl");
    steps.push(getFinalStep(ctx.request));

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};

function getDebtChange(
  loan: UpdateBorrowPositionRequest["loan"],
  prevLoan: UpdateBorrowPositionRequest["prevLoan"],
) {
  return dn.sub(loan.borrowed, prevLoan.borrowed);
}

function getCollChange(
  loan: UpdateBorrowPositionRequest["loan"],
  prevLoan: UpdateBorrowPositionRequest["prevLoan"],
) {
  return dn.sub(loan.deposit, prevLoan.deposit);
}

function getFinalStep(
  request: UpdateBorrowPositionRequest,
): "adjustTrove" | "adjustZombieTrove" | "depositBold" | "depositColl" | "withdrawBold" | "withdrawColl" {
  if (request.loan.isZombie) return "adjustZombieTrove";

  const collChange = getCollChange(request.loan, request.prevLoan);
  const debtChange = getDebtChange(request.loan, request.prevLoan);

  // both coll and debt change => adjust trove
  if (!dn.eq(collChange, 0) && !dn.eq(debtChange, 0)) return "adjustTrove";

  // coll increases => deposit
  if (dn.gt(collChange, 0)) return "depositColl";

  // coll decreases => withdraw
  if (dn.lt(collChange, 0)) return "withdrawColl";

  // debt increases => withdraw BOLD (borrow)
  if (dn.gt(debtChange, 0)) return "withdrawBold";

  // debt decreases => deposit BOLD (repay)
  if (dn.lt(debtChange, 0)) return "depositBold";

  throw new Error("Invalid request");
}

function useUpfrontFeeData(
  loan: UpdateBorrowPositionRequest["loan"],
  prevLoan: UpdateBorrowPositionRequest["prevLoan"],
) {
  const debtChange = dn.sub(loan.borrowed, prevLoan.borrowed);
  const isBorrowing = dn.gt(debtChange, 0);

  const upfrontFee = usePredictAdjustTroveUpfrontFee(
    loan.branchId,
    loan.troveId,
    isBorrowing ? debtChange : [0n, 18],
  );

  return {
    ...upfrontFee,
    data: !upfrontFee.data ? null : {
      isBorrowing,
      debtChangeWithFee: isBorrowing
        ? dn.add(debtChange, upfrontFee.data)
        : debtChange,
      upfrontFee: upfrontFee.data,
    },
  };
}
