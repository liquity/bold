import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getLeverDownTroveParams, getLeverUpTroveParams } from "@/src/liquity-leverage";
import { getCollToken, usePredictAdjustTroveUpfrontFee } from "@/src/liquity-utils";
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
import { readContract, writeContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction, verifyTroveUpdate } from "./shared";

const RequestSchema = createRequestSchema(
  "updateLeveragePosition",
  {
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
  },
);

export type UpdateLeveragePositionRequest = v.InferOutput<typeof RequestSchema>;

function useUpfrontFeeData(
  loan: UpdateLeveragePositionRequest["loan"],
  prevLoan: UpdateLeveragePositionRequest["prevLoan"],
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

export const updateLeveragePosition: FlowDeclaration<UpdateLeveragePositionRequest> = {
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
            label="Deposit change"
            value={[
              <Amount
                key="start"
                fallback="…"
                value={depositChange}
                suffix={` ${collateral.name}`}
                format={{
                  digits: 2,
                  signDisplay: "exceptZero",
                }}
              />,
              <Amount
                key="end"
                fallback="…"
                value={collPrice.data && dn.mul(depositChange, collPrice.data)}
                prefix="$"
              />,
            ]}
          />
        )}
        {leverageFactorChange && (
          <TransactionDetailsRow
            label={isBorrowing ? "Multiply increase" : "Multiply decrease"}
            value={[
              <div key="start">
                {fmtnum(leverageFactorChange[1] - leverageFactorChange[0], {
                  digits: 2,
                  signDisplay: "exceptZero",
                })}x
              </div>,
              <div key="end">
                {fmtnum(leverageFactorChange[1], 2)}x multiply
              </div>,
            ]}
          />
        )}
        <TransactionDetailsRow
          label={isBorrowing ? "Additional debt" : "Debt reduction"}
          value={[
            <Amount
              key="start"
              fallback="…"
              value={debtChangeWithFee}
              suffix=" BOLD"
            />,
            upfrontFeeData.data?.upfrontFee
            && dn.gt(upfrontFeeData.data.upfrontFee, 0)
            && (
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
        if (!request.depositChange) {
          throw new Error("Invalid step: depositChange is required with approveLst");
        }

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.loan.collIndex}`);
        }
        const Zapper = collateral.contracts.LeverageLSTZapper;

        return writeContract(wagmiConfig, {
          ...collateral.contracts.CollToken,
          functionName: "approve",
          args: [
            Zapper.address,
            preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : request.depositChange[0], // exact amount
          ],
        });
      },
      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    increaseDeposit: {
      name: () => "Increase Deposit",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        if (!request.depositChange) {
          throw new Error("Invalid step: depositChange is required with increaseDeposit");
        }

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.loan.collIndex}`);
        }

        // add ETH
        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "addCollWithRawETH",
            args: [BigInt(request.loan.troveId)],
            value: request.depositChange[0],
          });
        }

        // add LST
        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "addColl",
          args: [BigInt(request.loan.troveId), request.depositChange[0]],
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(
          wagmiConfig,
          hash,
          request.loan.collIndex,
          request.loan.updatedAt,
        );
      },
    },

    decreaseDeposit: {
      name: () => "Decrease Deposit",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        if (!request.depositChange) {
          throw new Error("Invalid step: depositChange is required with decreaseDeposit");
        }

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.loan.collIndex}`);
        }

        const args = [BigInt(request.loan.troveId), request.depositChange[0] * -1n] as const;

        // withdraw ETH
        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "withdrawCollToRawETH",
            args,
          });
        }

        // withdraw LST
        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "withdrawColl",
          args,
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(
          wagmiConfig,
          hash,
          request.loan.collIndex,
          request.loan.updatedAt,
        );
      },
    },

    leverUpTrove: {
      name: () => "Increase Multiplier",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        if (!request.leverageFactorChange) {
          throw new Error("Invalid step: leverageFactorChange is required with leverUpTrove");
        }

        const params = await getLeverUpTroveParams(
          request.loan.collIndex,
          request.loan.troveId,
          request.leverageFactorChange[1],
          wagmiConfig,
        );
        if (!params) {
          throw new Error("Couldn't fetch trove lever up params");
        }

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.loan.collIndex}`);
        }

        const args = [{
          troveId: BigInt(request.loan.troveId),
          flashLoanAmount: params.flashLoanAmount,
          boldAmount: params.effectiveBoldAmount,
          maxUpfrontFee: MAX_UPFRONT_FEE,
        }] as const;

        // leverage up ETH trove
        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "leverUpTrove",
            args,
          });
        }

        // leverage up LST trove
        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "leverUpTrove",
          args,
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(
          wagmiConfig,
          hash,
          request.loan.collIndex,
          request.loan.updatedAt,
        );
      },
    },

    leverDownTrove: {
      name: () => "Decrease Multiplier",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        if (!request.leverageFactorChange) {
          throw new Error("Invalid step: leverageFactorChange is required with leverDownTrove");
        }

        const params = await getLeverDownTroveParams(
          request.loan.collIndex,
          request.loan.troveId,
          request.leverageFactorChange[1],
          wagmiConfig,
        );
        if (!params) {
          throw new Error("Couldn't fetch trove lever down params");
        }

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.loan.collIndex}`);
        }

        const args = [{
          troveId: BigInt(request.loan.troveId),
          flashLoanAmount: params.flashLoanAmount,
          minBoldAmount: params.minBoldAmount,
        }] as const;

        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...collateral.contracts.LeverageWETHZapper,
            functionName: "leverDownTrove",
            args,
          });
        }

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "leverDownTrove",
          args,
        });
      },

      async verify({ request, wagmiConfig }, hash) {
        await verifyTroveUpdate(
          wagmiConfig,
          hash,
          request.loan.collIndex,
          request.loan.updatedAt,
        );
      },
    },
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const { depositChange, leverageFactorChange, loan } = request;

    const collateral = contracts.collaterals[loan.collIndex];
    if (!collateral) {
      throw new Error(`Invalid collateral index: ${loan.collIndex}`);
    }

    const steps: string[] = [];

    // only check approval for non-ETH collaterals
    if (collateral.symbol !== "ETH" && depositChange && dn.gt(depositChange, 0)) {
      const { LeverageLSTZapper, CollToken } = collateral.contracts;
      const allowance = dnum18(
        await readContract(wagmiConfig, {
          ...CollToken,
          functionName: "allowance",
          args: [account ?? ADDRESS_ZERO, LeverageLSTZapper.address],
        }),
      );

      if (dn.lt(allowance, depositChange)) {
        steps.push("approveLst");
      }
    }

    if (depositChange) {
      steps.push(dn.gt(depositChange, 0) ? "increaseDeposit" : "decreaseDeposit");
    }

    if (leverageFactorChange) {
      const [oldLeverage, newLeverage] = leverageFactorChange;
      steps.push(newLeverage > oldLeverage ? "leverUpTrove" : "leverDownTrove");
    }

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
