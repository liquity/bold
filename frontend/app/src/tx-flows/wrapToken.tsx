import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum, vUnderlyingToken } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";
import { readContract } from "wagmi/actions";
import { erc20Abi, maxUint256 } from "viem";
import { fmtnum } from "../formatting";
import { usePrice } from "../services/Prices";

const RequestSchema = createRequestSchema(
  "wrapToken",
  {
    amount: vDnum(),
    token: vUnderlyingToken(),
  },
);

export type WrapTokenRequest = v.InferOutput<typeof RequestSchema>;

export const wrapToken: FlowDeclaration<WrapTokenRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return <></>
  },

  Details({ request }) {
    const { amount, token } = request;
    const wbtcPrice = usePrice("BTCB");

    return wbtcPrice.data && (
      <>
        <TransactionDetailsRow
          label="Deposit Amount"
          value={[
            `${fmtnum(request.amount)} WBTC`,
            <Amount
              key="end"
              fallback="…"
              prefix="$"
              value={wbtcPrice.data && dn.mul(request.amount, wbtcPrice.data)}
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

    // wrap Token
    wrapToken: {
      name: () => "Wrap Token",
      Status: TransactionStatus,

      async commit(ctx) {
        console.log("commit", ctx.request.amount[0]);
        return ctx.writeContract({
          address: "0xF329F1BF880760bE580f0422475f8d101cb29Ad6",
          abi: [{ "inputs": [{ "internalType": "contract IERC20Metadata", "name": "underlyingToken", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "subtractedValue", "type": "uint256" }], "name": "decreaseAllowance", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "deposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "addedValue", "type": "uint256" }], "name": "increaseAllowance", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "from", "type": "address" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "underlying", "outputs": [{ "internalType": "contract IERC20Metadata", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
          functionName: "deposit" as const,
          args: [ctx.request.amount[0]],
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
      args: [ctx.account, "0xF329F1BF880760bE580f0422475f8d101cb29Ad6"],
    });

    const steps: string[] = [];

    if (allowance < ctx.request.amount[0]) {
      steps.push("approve");
    }

    steps.push("wrapToken");
    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
