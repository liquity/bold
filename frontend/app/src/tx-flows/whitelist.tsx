import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vAddress } from "@/src/valibot-utils";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const whitelistAbi = [
  {
    inputs: [
      {
        name: "callingContract",
        type: "address",
      },
      {
        name: "user",
        type: "address",
      },
    ],
    name: "isWhitelisted",
    outputs: [
      {
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        name: "callingContract",
        type: "address",
      },
      {
        name: "user",
        type: "address",
      },
    ],
    name: "addToWhitelist",
    stateMutability: "public",
    type: "function",
  },
  {
    inputs: [
      {
        name: "callingContract",
        type: "address",
      },
      {
        name: "user",
        type: "address",
      },
    ],
    name: "removeFromWhitelist",
    stateMutability: "public",
    type: "function",
  },
] as const;

const RemoveRequestSchema = createRequestSchema("removeFromWhitelist", {
  whitelist: vAddress(),
  callingContract: vAddress(),
  user: vAddress(),
});

export type RemoveFromWhitelistRequest = v.InferOutput<
  typeof RemoveRequestSchema
>;

export const removeFromWhitelist: FlowDeclaration<RemoveFromWhitelistRequest> =
  {
    title: "Review & Send Transaction",

    Summary({ request }) {
      return <></>;
    },

    Details({ request }) {
      const { callingContract, user, whitelist } = request;

      return (
        <>
          <TransactionDetailsRow
            label="Whitelist contract"
            value={[whitelist]}
          />
          <TransactionDetailsRow
            label="Calling contract"
            value={[callingContract]}
          />
          <TransactionDetailsRow label="User to remove from whitelist" value={[user]} />
        </>
      );
    },

    steps: {
      // Remove from Whitelist
      removeFromWhitelist: {
        name: (ctx) => {
          return `Remove user from whitelist`;
        },
        Status: (props) => <TransactionStatus {...props} approval="all" />,
        async commit(ctx) {
          return ctx.writeContract({
            address: ctx.request.whitelist,
            abi: whitelistAbi,
            functionName: "removeFromWhitelist",
            args: [ctx.request.callingContract, ctx.request.user],
          });
        },
        async verify(ctx, hash) {
          await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
        },
      },
    },

    async getSteps(ctx) {
      const steps: string[] = [];

      steps.push("removeFromWhitelist");
      return steps;
    },

    parseRequest(request) {
      return v.parse(RemoveRequestSchema, request);
    },
  };

const AddRequestSchema = createRequestSchema("addToWhitelist", {
  whitelist: vAddress(),
  callingContract: vAddress(),
  user: vAddress(),
});

export type AddToWhitelistRequest = v.InferOutput<typeof AddRequestSchema>;

export const addToWhitelist: FlowDeclaration<AddToWhitelistRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return <></>;
  },

  Details({ request }) {
    const { callingContract, user, whitelist } = request;

    return (
      <>
        <TransactionDetailsRow label="Whitelist contract" value={[whitelist]} />
        <TransactionDetailsRow
          label="Calling contract"
          value={[callingContract]}
        />
        <TransactionDetailsRow label="User to whitelist" value={[user]} />
      </>
    );
  },

  steps: {
    // Add To Whitelist
    addToWhitelist: {
      name: (ctx) => {
        return `Add user to whitelist`;
      },
      Status: (props) => <TransactionStatus {...props} approval="all" />,
      async commit(ctx) {
        return ctx.writeContract({
          address: ctx.request.whitelist,
          abi: whitelistAbi,
          functionName: "addToWhitelist",
          args: [ctx.request.callingContract, ctx.request.user],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps: string[] = [];

    steps.push("addToWhitelist");
    return steps;
  },

  parseRequest(request) {
    return v.parse(AddRequestSchema, request);
  },
};