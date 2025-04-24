import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum, vUnderlyingToken } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";
import { readContract, sendTransaction } from "wagmi/actions";
import { erc20Abi, maxUint256 } from "viem";
import { fmtnum } from "@/src/formatting";
import { usePrice } from "@/src/services/Prices";
import { ENSO_API_KEY } from "@/src/env";

const RequestSchema = createRequestSchema(
  "buyStable",
  {
    amount: vDnum(),
    token: vUnderlyingToken(),
  },
);

export type BuyStableRequest = v.InferOutput<typeof RequestSchema>;

export const buyStable: FlowDeclaration<BuyStableRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return <></>
  },

  Details({ request }) {
    const { amount, token } = request;
    const wbtcPrice = usePrice("WBTC");

    return wbtcPrice.data && (
      <>
        <TransactionDetailsRow
          label="Sell Amount"
          value={[
            `${fmtnum(amount)} WBTC`,
            <Amount
              key="end"
              fallback="…"
              prefix="$"
              value={wbtcPrice.data && dn.mul(amount, wbtcPrice.data)}
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Buy Amount"
          value={[
            `${fmtnum(dn.mul(amount, wbtcPrice.data))} bvUSD`,
            <Amount
              key="end"
              fallback="…"
              prefix="$"
              value={wbtcPrice.data && dn.mul(amount, wbtcPrice.data)}
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    // Approve
    approve: {
      name: (ctx) => {
        return `Approve Token`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        return ctx.writeContract({
          address: ctx.request.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [
            "0xF329F1BF880760bE580f0422475f8d101cb29Ad6",
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : ctx.request.amount[0], // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    // buy stable
    buyStable: {
      name: () => "Buy bvUSD",
      Status: TransactionStatus,

      async commit(ctx) {
        const ensoRes = (await fetch(
          `https://api.enso.finance/api/v1/shortcuts/route?chainId=56&fromAddress=${ctx.account}&spender=${ctx.account}&receiver=${ctx.account}&amountIn=${ctx.request.amount.toLocaleString("fullwide", { useGrouping: false })}&slippage=100&tokenIn=${ctx.request.token}&tokenOut=0x0471D185cc7Be61E154277cAB2396cD397663da6&routingStrategy=router`,
          { headers: { Authorization: `Bearer ${ENSO_API_KEY}` } }
        ))
        const ensoResJson = await ensoRes.json()
        
        return sendTransaction(ctx.wagmiConfig, { 
          chain: 56, 
          account: ctx.account, 
          to: ensoResJson.tx.to,
          data: ensoResJson.tx.data as `0x${string}`,
          value: ensoResJson.tx.value 
          });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    // Check if approval is needed
    const allowance = await readContract(ctx.wagmiConfig, {
      address: ctx.request.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [ctx.account, "0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf"],
    });

    const steps: string[] = [];

    if (allowance < ctx.request.amount[0]) {
      steps.push("approve");
    }

    steps.push("buyStable");
    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
