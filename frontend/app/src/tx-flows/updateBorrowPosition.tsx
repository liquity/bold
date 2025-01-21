import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import { getCollToken, usePredictAdjustTroveUpfrontFee } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionLoanCommited } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { readContract, writeContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction, verifyTroveUpdate } from "./shared";

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
            label={isBorrowing ? "You borrow" : "You repay"}
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
      async commit({
        contracts,
        request,
        wagmiConfig,
        preferredApproveMethod,
      }) {
        const debtChange = getDebtChange(request.loan, request.prevLoan);
        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + request.loan.collIndex);
        }
        const Controller = collateral.symbol === "ETH"
          ? collateral.contracts.LeverageWETHZapper
          : collateral.contracts.LeverageLSTZapper;

        return writeContract(wagmiConfig, {
          ...contracts.BoldToken,
          functionName: "approve",
          args: [
            Controller.address,
            preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : dn.abs(debtChange)[0], // exact amount
          ],
        });
      },
      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    approveColl: {
      name: ({ contracts, request }) => {
        const coll = contracts.collaterals[request.loan.collIndex];
        if (!coll) {
          throw new Error("Invalid collateral index: " + request.loan.collIndex);
        }
        return `Approve ${coll.symbol}`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit({
        contracts,
        request,
        wagmiConfig,
        preferredApproveMethod,
      }) {
        const collChange = getCollChange(request.loan, request.prevLoan);

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + request.loan.collIndex);
        }

        const Controller = collateral.contracts.LeverageLSTZapper;

        return writeContract(wagmiConfig, {
          ...collateral.contracts.CollToken,
          functionName: "approve",
          args: [
            Controller.address,
            preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : dn.abs(collChange)[0], // exact amount
          ],
        });
      },
      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    // update both collateral and debt
    adjustTrove: {
      name: () => "Update Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan, maxUpfrontFee } = request;
        const collChange = getCollChange(loan, request.prevLoan);
        const debtChange = getDebtChange(loan, request.prevLoan);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "adjustTroveWithRawETH",
            args: [
              BigInt(loan.troveId),
              dn.abs(collChange)[0],
              !dn.lt(collChange, 0n),
              dn.abs(debtChange)[0],
              !dn.lt(debtChange, 0n),
              maxUpfrontFee[0],
            ],
            value: dn.gt(collChange, 0n) ? collChange[0] : 0n,
          });
        }

        return writeContract(wagmiConfig, {
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

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(wagmiConfig, hash, request.loan);
      },
    },

    depositBold: {
      name: () => "Update Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan } = request;
        const debtChange = getDebtChange(loan, request.prevLoan);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "repayBold",
            args: [BigInt(loan.troveId), dn.abs(debtChange)[0]],
          });
        }

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "repayBold",
          args: [BigInt(loan.troveId), dn.abs(debtChange)[0]],
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(wagmiConfig, hash, request.loan);
      },
    },

    depositColl: {
      name: () => "Update Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan } = request;
        const collChange = getCollChange(loan, request.prevLoan);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "addCollWithRawETH",
            args: [BigInt(loan.troveId)],
            value: dn.abs(collChange)[0],
          });
        }

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "addColl",
          args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(wagmiConfig, hash, request.loan);
      },
    },

    withdrawBold: {
      name: () => "Update Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan, maxUpfrontFee } = request;
        const debtChange = getDebtChange(loan, request.prevLoan);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "withdrawBold",
            args: [BigInt(loan.troveId), dn.abs(debtChange)[0], maxUpfrontFee[0]],
          });
        }

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "withdrawBold",
          args: [BigInt(loan.troveId), dn.abs(debtChange)[0], maxUpfrontFee[0]],
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(wagmiConfig, hash, request.loan);
      },
    },

    withdrawColl: {
      name: () => "Update Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan } = request;
        const collChange = getCollChange(loan, request.prevLoan);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "withdrawCollToRawETH",
            args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
          });
        }

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "withdrawColl",
          args: [BigInt(loan.troveId), dn.abs(collChange)[0]],
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(wagmiConfig, hash, request.loan);
      },
    },
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const debtChange = getDebtChange(request.loan, request.prevLoan);
    const collChange = getCollChange(request.loan, request.prevLoan);
    const coll = contracts.collaterals[request.loan.collIndex];
    if (!coll) {
      throw new Error("Invalid collateral index: " + request.loan.collIndex);
    }

    const Controller = coll.symbol === "ETH"
      ? coll.contracts.LeverageWETHZapper
      : coll.contracts.LeverageLSTZapper;

    if (!account) {
      throw new Error("Account address is required");
    }

    const isBoldApproved = !dn.lt(debtChange, 0) || !dn.gt(dn.abs(debtChange), [
      await readContract(wagmiConfig, {
        ...contracts.BoldToken,
        functionName: "allowance",
        args: [account, Controller.address],
      }) ?? 0n,
      18,
    ]);

    // Collateral token needs to be approved if collChange > 0 and collToken != "ETH" (no LeverageWETHZapper)
    const isCollApproved = coll.symbol === "ETH" || !dn.gt(collChange, 0) || !dn.gt(collChange, [
      await readContract(wagmiConfig, {
        ...coll.contracts.CollToken,
        functionName: "allowance",
        args: [account, Controller.address],
      }) ?? 0n,
      18,
    ]);

    const steps: string[] = [];

    if (!isBoldApproved) steps.push("approveBold");
    if (!isCollApproved) steps.push("approveColl");

    steps.push(getFinalStep(request));

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
): "adjustTrove" | "depositBold" | "depositColl" | "withdrawBold" | "withdrawColl" {
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
    loan.collIndex,
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
