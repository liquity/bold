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
import { readContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema("closeLoanPosition", {
  loan: vPositionLoanCommited(),
  repayWithCollateral: v.boolean(),
});

export type CloseLoanPositionRequest = v.InferOutput<typeof RequestSchema>;

export const closeLoanPosition: FlowDeclaration<CloseLoanPositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <LoanCard
        leverageMode={false}
        loadingState='success'
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
      ? dn.div(loan.borrowed ?? dn.from(0), collPrice.data)
      : loan.borrowed ?? dn.from(0);

    const collToReclaim = repayWithCollateral
      ? dn.sub(loan.deposit, amountToRepay)
      : loan.deposit;

    return (
      <>
        {dn.gt(amountToRepay, 0) && (
          <TransactionDetailsRow
            label={
              repayWithCollateral ? "You repay (from collateral)" : "You repay"
            }
            value={[
              <Amount
                key='start'
                value={amountToRepay}
                suffix={` ${repayWithCollateral ? collateral.symbol : "USND"}`}
              />,
            ]}
          />
        )}
        <TransactionDetailsRow
          label='You reclaim collateral'
          value={[
            <Amount
              key='start'
              value={collToReclaim}
              suffix={` ${collateral.symbol}`}
            />,
          ]}
        />
        <TransactionDetailsRow
          label='You reclaim the gas compensation deposit'
          value={[
            <div
              key='start'
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
      name: () => "Approve USND",
      Status: (props) => (
        <TransactionStatus {...props} approval='approve-only' />
      ),
      async commit(ctx) {
        const { loan } = ctx.request;
        const coll = ctx.contracts.collaterals[loan.collIndex];
        if (!coll) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }
        const { entireDebt } = await readContract(ctx.wagmiConfig, {
          ...coll.contracts.TroveManager,
          functionName: "getLatestTroveData",
          args: [BigInt(loan.troveId)],
        });

        const Zapper =
          coll.symbol === "ETH"
            ? coll.contracts.LeverageWETHZapper
            : coll.contracts.LeverageLSTZapper;

        return ctx.writeContract({
          ...ctx.contracts.BoldToken,
          functionName: "approve",
          args: [
            Zapper.address,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : dn.mul([entireDebt, 18], 1.1)[0], // exact amount (TODO: better estimate)
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    // Close a loan position, repaying with USND or with the collateral
    closeLoanPosition: {
      name: () => "Close loan",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;
        const coll = ctx.contracts.collaterals[loan.collIndex];
        if (!coll) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }

        // repay with USND => get ETH
        if (!ctx.request.repayWithCollateral && coll.symbol === "ETH") {
          return ctx.writeContract({
            ...coll.contracts.LeverageWETHZapper,
            functionName: "closeTroveToRawETH",
            args: [BigInt(loan.troveId)],
          });
        }

        // repay with USND => get LST
        if (!ctx.request.repayWithCollateral) {
          return ctx.writeContract({
            ...coll.contracts.LeverageLSTZapper,
            functionName: "closeTroveToRawETH",
            args: [BigInt(loan.troveId)],
          });
        }

        // from here, we are repaying with the collateral

        const closeFlashLoanAmount = await getCloseFlashLoanAmount(
          loan.collIndex,
          loan.troveId,
          ctx.wagmiConfig
        );

        if (closeFlashLoanAmount === null) {
          throw new Error("The flash loan amount could not be calculated.");
        }

        // repay with collateral => get ETH
        if (coll.symbol === "ETH") {
          return ctx.writeContract({
            ...coll.contracts.LeverageWETHZapper,
            functionName: "closeTroveFromCollateral",
            args: [BigInt(loan.troveId), closeFlashLoanAmount],
          });
        }

        // repay with collateral => get LST
        return ctx.writeContract({
          ...coll.contracts.LeverageLSTZapper,
          functionName: "closeTroveFromCollateral",
          args: [BigInt(loan.troveId), closeFlashLoanAmount],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);

        const prefixedTroveId = getPrefixedTroveId(
          ctx.request.loan.collIndex,
          ctx.request.loan.troveId
        );

        // wait for the trove to be seen as closed in the subgraph
        while (true) {
          const { trove } = await graphQuery(TroveByIdQuery, {
            id: prefixedTroveId,
          });
          if (trove?.closedAt !== undefined) {
            break;
          }
          await sleep(1000);
        }
      },
    },
  },

  async getSteps(ctx) {
    if (!ctx.account) {
      throw new Error("Account address is required");
    }

    const { loan } = ctx.request;

    const coll = ctx.contracts.collaterals[loan.collIndex];
    if (!coll) {
      throw new Error("Invalid collateral index: " + loan.collIndex);
    }

    const Zapper =
      coll.symbol === "ETH"
        ? coll.contracts.LeverageWETHZapper
        : coll.contracts.LeverageLSTZapper;

    const { entireDebt } = await ctx.readContract({
      ...coll.contracts.TroveManager,
      functionName: "getLatestTroveData",
      args: [BigInt(loan.troveId)],
    });

    const isBoldApproved =
      ctx.request.repayWithCollateral ||
      !dn.gt(entireDebt, [
        (await ctx.readContract({
          ...ctx.contracts.BoldToken,
          functionName: "allowance",
          args: [ctx.account, Zapper.address],
        })) ?? 0n,
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
