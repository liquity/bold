import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { getUserAllocatedInitiatives } from "@/src/liquity-governance";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { encodeFunctionData } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "unstakeDeposit",
  {
    lqtyAmount: vDnum(),
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type UnstakeDepositRequest = v.InferOutput<typeof RequestSchema>;

export const unstakeDeposit: FlowDeclaration<UnstakeDepositRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <StakePositionSummary
        prevStakePosition={request.prevStakePosition}
        stakePosition={request.stakePosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const lqtyPrice = usePrice("LQTY");
    return (
      <TransactionDetailsRow
        label={[
          "You withdraw",
          "Your voting power will be reset.",
        ]}
        value={[
          <Amount
            key="start"
            suffix=" LQTY"
            value={request.lqtyAmount}
          />,
          <Amount
            key="end"
            prefix="$"
            value={lqtyPrice.data && dn.mul(request.lqtyAmount, lqtyPrice.data)}
          />,
        ]}
      />
    );
  },

  steps: {
    resetVotesAndWithdraw: {
      name: () => "Unstake",
      Status: TransactionStatus,
      async commit(ctx) {
        const { Governance } = ctx.contracts;
        const inputs: `0x${string}`[] = [];

        const allocatedInitiatives = await getUserAllocatedInitiatives(
          ctx.wagmiConfig,
          ctx.account,
        );

        // reset allocations if the user has any
        if (allocatedInitiatives.length > 0) {
          inputs.push(encodeFunctionData({
            abi: Governance.abi,
            functionName: "resetAllocations",
            args: [allocatedInitiatives, true],
          }));
        }

        // withdraw LQTY
        inputs.push(encodeFunctionData({
          abi: Governance.abi,
          functionName: "withdrawLQTY",
          args: [ctx.request.lqtyAmount[0]],
        }));

        return ctx.writeContract({
          ...Governance,
          functionName: "multiDelegateCall",
          args: [inputs],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["resetVotesAndWithdraw"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
