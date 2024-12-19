import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vCollIndex, vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { createRequestSchema } from "./shared";

const RequestSchema = createRequestSchema(
  "earnDeposit",
  {
    prevEarnPosition: v.union([
      v.null(),
      vPositionEarn(),
    ]),
    earnPosition: vPositionEarn(),
    collIndex: vCollIndex(),
    claim: v.boolean(),
  },
);

export type EarnDepositRequest = v.InferOutput<typeof RequestSchema>;

export const earnDeposit: FlowDeclaration<EarnDepositRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <EarnPositionSummary
        collIndex={request.collIndex}
        earnPosition={request.earnPosition}
        prevEarnPosition={request.prevEarnPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const boldPrice = usePrice("BOLD");
    const boldAmount = dn.sub(
      request.earnPosition.deposit,
      request.prevEarnPosition?.deposit ?? dn.from(0, 18),
    );
    return (
      <>
        <TransactionDetailsRow
          label="You deposit"
          value={[
            <Amount
              key="start"
              suffix=" BOLD"
              value={boldAmount}
            />,
            <Amount
              key="end"
              prefix="$"
              value={boldPrice.data && dn.mul(boldAmount, boldPrice.data)}
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    provideToStabilityPool: {
      name: () => "Add deposit",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const collateral = contracts.collaterals[request.collIndex];
        const boldAmount = dn.sub(
          request.earnPosition.deposit,
          request.prevEarnPosition?.deposit ?? dn.from(0, 18),
        );

        return writeContract(wagmiConfig, {
          ...collateral.contracts.StabilityPool,
          functionName: "provideToSP",
          args: [
            boldAmount[0],
            request.claim,
          ],
        });
      },

      async verify({ wagmiConfig }, hash) {
        await waitForTransactionReceipt(wagmiConfig, {
          hash: hash as `0x${string}`,
        });
      },
    },
  },

  async getSteps() {
    return ["provideToStabilityPool"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
