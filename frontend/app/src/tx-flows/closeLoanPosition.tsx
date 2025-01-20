import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { fmtnum } from "@/src/formatting";
import { getCloseFlashLoanAmount } from "@/src/liquity-leverage";
import { getCollToken, getPrefixedTroveId } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { sleep } from "@/src/utils";
import { vPositionLoanCommited } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { readContract, writeContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "closeLoanPosition",
  {
    loan: vPositionLoanCommited(),
    repayWithCollateral: v.boolean(),
  },
);

export type CloseLoanPositionRequest = v.InferOutput<typeof RequestSchema>;

export const closeLoanPosition: FlowDeclaration<CloseLoanPositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <LoanCard
        leverageMode={false}
        loadingState="success"
        loan={null}
        prevLoan={request.loan}
        onRetry={() => {}}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { loan, repayWithCollateral } = request;
    const collateral = getCollToken(loan.collIndex);

    if (!collateral) {
      throw new Error("Invalid collateral index: " + loan.collIndex);
    }

    const collPrice = usePrice(collateral.symbol);

    if (!collPrice.data) {
      return null;
    }

    const amountToRepay = repayWithCollateral
      ? (dn.div(loan.borrowed ?? dn.from(0), collPrice.data))
      : (loan.borrowed ?? dn.from(0));

    const collToReclaim = repayWithCollateral
      ? dn.sub(loan.deposit, amountToRepay)
      : loan.deposit;

    return (
      <>
        {dn.gt(amountToRepay, 0) && (
          <TransactionDetailsRow
            label={repayWithCollateral ? "You repay (from collateral)" : "You repay"}
            value={[
              <Amount
                key="start"
                value={amountToRepay}
                suffix={` ${repayWithCollateral ? collateral.symbol : "BOLD"}`}
              />,
            ]}
          />
        )}
        <TransactionDetailsRow
          label="You reclaim collateral"
          value={[
            <Amount
              key="start"
              value={collToReclaim}
              suffix={` ${collateral.symbol}`}
            />,
          ]}
        />
        <TransactionDetailsRow
          label="You reclaim the gas compensation deposit"
          value={[
            <div
              key="start"
              title={`${fmtnum(ETH_GAS_COMPENSATION, "full")} ETH`}
            >
              {fmtnum(ETH_GAS_COMPENSATION, 4)} ETH
            </div>,
          ]}
        />
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
        const { loan } = request;
        const coll = contracts.collaterals[loan.collIndex];
        if (!coll) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }
        const { entireDebt } = await readContract(wagmiConfig, {
          ...coll.contracts.TroveManager,
          functionName: "getLatestTroveData",
          args: [BigInt(loan.troveId)],
        });

        const Zapper = coll.symbol === "ETH"
          ? coll.contracts.LeverageWETHZapper
          : coll.contracts.LeverageLSTZapper;

        return writeContract(wagmiConfig, {
          ...contracts.BoldToken,
          functionName: "approve",
          args: [
            Zapper.address,
            preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : dn.mul([entireDebt, 18], 1.1)[0], // exact amount (TODO: better estimate)
          ],
        });
      },
      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    // Close a loan position, repaying with BOLD or with the collateral
    closeLoanPosition: {
      name: () => "Close loan",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan } = request;
        const coll = contracts.collaterals[loan.collIndex];
        if (!coll) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        // repay with BOLD => get ETH
        if (!request.repayWithCollateral && coll.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...coll.contracts.LeverageWETHZapper,
            functionName: "closeTroveToRawETH",
            args: [BigInt(loan.troveId)],
          });
        }

        // repay with BOLD => get LST
        if (!request.repayWithCollateral) {
          return writeContract(wagmiConfig, {
            ...coll.contracts.LeverageLSTZapper,
            functionName: "closeTroveToRawETH",
            args: [BigInt(loan.troveId)],
          });
        }

        // from here, we are repaying with the collateral

        const closeFlashLoanAmount = await getCloseFlashLoanAmount(
          loan.collIndex,
          loan.troveId,
          wagmiConfig,
        );

        if (closeFlashLoanAmount === null) {
          throw new Error("The flash loan amount could not be calculated.");
        }

        // repay with collateral => get ETH
        if (coll.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...coll.contracts.LeverageWETHZapper,
            functionName: "closeTroveFromCollateral",
            args: [BigInt(loan.troveId), closeFlashLoanAmount],
          });
        }

        // repay with collateral => get LST
        return writeContract(wagmiConfig, {
          ...coll.contracts.LeverageLSTZapper,
          functionName: "closeTroveFromCollateral",
          args: [BigInt(loan.troveId), closeFlashLoanAmount],
        });
      },

      async verify({ request, wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);

        const prefixedTroveId = getPrefixedTroveId(
          request.loan.collIndex,
          request.loan.troveId,
        );

        // wait for the trove to be seen as closed in the subgraph
        while (true) {
          const { trove } = await graphQuery(TroveByIdQuery, { id: prefixedTroveId });
          if (trove?.closedAt !== undefined) {
            break;
          }
          await sleep(1000);
        }
      },
    },
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    if (!account) {
      throw new Error("Account address is required");
    }

    const { loan } = request;

    const coll = contracts.collaterals[loan.collIndex];
    if (!coll) {
      throw new Error("Invalid collateral index: " + loan.collIndex);
    }

    const Zapper = coll.symbol === "ETH"
      ? coll.contracts.LeverageWETHZapper
      : coll.contracts.LeverageLSTZapper;

    const { entireDebt } = await readContract(wagmiConfig, {
      ...coll.contracts.TroveManager,
      functionName: "getLatestTroveData",
      args: [BigInt(loan.troveId)],
    });

    const isBoldApproved = request.repayWithCollateral || !dn.gt(entireDebt, [
      await readContract(wagmiConfig, {
        ...contracts.BoldToken,
        functionName: "allowance",
        args: [account, Zapper.address],
      }) ?? 0n,
      18,
    ]);

    const steps: string[] = [];

    if (!isBoldApproved) {
      steps.push("approveBold");
    }

    steps.push("closeLoanPosition");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
