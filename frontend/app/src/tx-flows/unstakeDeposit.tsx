import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { writeContract } from "wagmi/actions";
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
    const { rewards } = request.stakePosition;
    const lqtyPrice = usePrice("LQTY");
    const lusdPrice = usePrice("LUSD");
    const ethPrice = usePrice("ETH");

    const rewardsLusdInUsd = lusdPrice.data && dn.mul(rewards.lusd, lusdPrice.data);
    const rewardsEthInUsd = ethPrice.data && dn.mul(rewards.eth, ethPrice.data);

    return (
      <>
        <TransactionDetailsRow
          label="You withdraw"
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
        <TransactionDetailsRow
          label="Claiming LUSD rewards"
          value={[
            <Amount
              key="start"
              value={rewards.lusd}
              suffix=" LUSD"
            />,
            <Amount
              key="end"
              value={rewardsLusdInUsd}
              prefix="$"
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Claiming ETH rewards"
          value={[
            <Amount
              key="start"
              value={rewards.eth}
              suffix=" ETH"
            />,
            <Amount
              key="end"
              value={rewardsEthInUsd}
              prefix="$"
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    unstakeDeposit: {
      name: () => "Unstake",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        return writeContract(wagmiConfig, {
          ...contracts.LqtyStaking,
          functionName: "unstake",
          args: [request.lqtyAmount[0]],
        });
      },

      async verify({ wagmiConfig }, hash) {
        await verifyTransaction(wagmiConfig, hash);
      },
    },
  },

  async getSteps() {
    return ["unstakeDeposit"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
