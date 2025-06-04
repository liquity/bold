import type { FlowDeclaration, FlowParams } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { DNUM_0 } from "@/src/dnum-utils";
import { getBranch, getCollToken } from "@/src/liquity-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vBranchId, vPositionEarn } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";
import { VaultPositionSummary } from "@/src/comps/VaultPositionSummary/VaultPositionSummary";
import { Address, erc20Abi, erc4626Abi, getAddress, maxUint256, zeroAddress } from "viem";
import { readContract, sendTransaction, writeContract } from "wagmi/actions";
import { CONTRACT_ROUTER, CONTRACT_VAULT, ENSO_API_KEY } from "@/src/env";

const RequestSchema = createRequestSchema(
  "vaultUpdate",
  {
    prevEarnPosition: vPositionEarn(),
    earnPosition: vPositionEarn(),
    token: vAddress(),
    mode: v.union([v.literal("remove"), v.literal("add")]),
  },
);

export type VaultUpdateRequest = v.InferOutput<typeof RequestSchema>;

export const vaultUpdate: FlowDeclaration<VaultUpdateRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <VaultPositionSummary
        earnPosition={{
          ...request.earnPosition,

          // compound bvUSD rewards if not claiming
          deposit: request.earnPosition.deposit,
          rewards: {
            // bvUSD rewards are claimed or compounded
            bold: DNUM_0,
            coll: DNUM_0
          },
        }}
        prevEarnPosition={dn.eq(request.prevEarnPosition.deposit, 0)
          ? null
          : request.prevEarnPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { earnPosition, prevEarnPosition } = request;

    const collateral = getCollToken(earnPosition.branchId);

    const boldPrice = usePrice("bvUSD");
    const collPrice = usePrice(collateral.symbol);

    const depositChange = dn.sub(earnPosition.deposit, prevEarnPosition.deposit);

    const boldAmount = dn.abs(depositChange);
    const usdAmount = boldPrice.data && dn.mul(boldAmount, boldPrice.data);

    return (
      <>
        <TransactionDetailsRow
          label={dn.gt(depositChange, 0) ? "You deposit" : "You withdraw"}
          value={[
            <Amount
              key="start"
              suffix=" bvUSD"
              value={dn.abs(depositChange)}
            />,
            <Amount
              key="end"
              prefix="$"
              value={usdAmount}
            />,
          ]}
        />
      </>
    );
  },

  steps: {
    setOperator: {
      name: (ctx) => {
        return `Set Operator`;
      },
      Status: TransactionStatus,
      async commit(ctx) {
        return ctx.writeContract({
          address: CONTRACT_VAULT,
          abi: [{
            "inputs": [
              {
                "internalType": "address",
                "name": "operator",
                "type": "address"
              },
              {
                "internalType": "bool",
                "name": "approved",
                "type": "bool"
              }
            ],
            "name": "setOperator",
            "outputs": [
              {
                "internalType": "bool",
                "name": "success",
                "type": "bool"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
          }],
          functionName: "setOperator",
          args: [CONTRACT_ROUTER, true],
        })
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
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
        console.log("APPROVAL COMMIT")
        const { mode, earnPosition, prevEarnPosition } = ctx.request;
        let change: BigInt = BigInt(0);
        let spender: Address = zeroAddress
        if (mode === "add") {
          change = earnPosition.deposit[0] - prevEarnPosition.deposit[0];
          spender = CONTRACT_VAULT
        }
        else {
          change = prevEarnPosition.deposit[0] - earnPosition.deposit[0];
          spender = CONTRACT_ROUTER
        }
        console.log("Approval:", {token: ctx.request.token, spender, change})
        return ctx.writeContract({
          address: ctx.request.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [
            spender,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : change, // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    deposit: {
      name: () => "Deposit",
      Status: TransactionStatus,
      async commit(ctx) {
        const { earnPosition, prevEarnPosition } = ctx.request;
        const change = earnPosition.deposit[0] - prevEarnPosition.deposit[0];

        return ctx.writeContract({
          address: CONTRACT_VAULT,
          abi: erc4626Abi,
          functionName: "deposit",
          args: [change, ctx.account],
        });

        // const ensoRes = (await fetch(
        //   `https://api.enso.finance/api/v1/shortcuts/route?chainId=56&fromAddress=${ctx.account}&spender=${ctx.account}&receiver=${ctx.account}&amountIn=${change.toLocaleString("fullwide", { useGrouping: false })}&slippage=10&tokenIn=0x55d398326f99059fF775485246999027B3197955&tokenOut=0x0471D185cc7Be61E154277cAB2396cD397663da6&routingStrategy=router`,
        //   { headers: { Authorization: `Bearer ${ENSO_API_KEY}` } }
        // ))
        // const ensoResJson = await ensoRes.json()

        // return sendTransaction(ctx.wagmiConfig, { 
        //   chain: 56, 
        //   account: ctx.account, 
        //   to: ensoResJson.tx.to,
        //   data: ensoResJson.tx.data as `0x${string}`,
        //   value: ensoResJson.tx.value 
        //   });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    withdraw: {
      name: () => "Withdraw",
      Status: TransactionStatus,
      async commit(ctx) {
        const { earnPosition, prevEarnPosition } = ctx.request;
        const change = prevEarnPosition.deposit[0] - earnPosition.deposit[0];

        const shares = await readContract(ctx.wagmiConfig, {
          address: CONTRACT_VAULT,
          abi: erc4626Abi,
          functionName: "convertToShares",
          args: [change],
        });

        return ctx.writeContract({
          address: CONTRACT_ROUTER,
          abi: [{
            "inputs": [
              {
                "internalType": "address",
                "name": "vault",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "shares",
                "type": "uint256"
              }
            ],
            "name": "requestFulfillWithdraw",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }],
          functionName: "requestFulfillWithdraw",
          args: [CONTRACT_VAULT, ctx.account, shares],
        });

        // const ensoRes = (await fetch(
        //   `https://api.enso.finance/api/v1/shortcuts/route?chainId=56&fromAddress=${ctx.account}&spender=${ctx.account}&receiver=${ctx.account}&amountIn=${change.toLocaleString("fullwide", { useGrouping: false })}&slippage=10&tokenIn=0x0471D185cc7Be61E154277cAB2396cD397663da6&tokenOut=0x55d398326f99059fF775485246999027B3197955&routingStrategy=router`,
        //   { headers: { Authorization: `Bearer ${ENSO_API_KEY}` } }
        // ))
        // const ensoResJson = await ensoRes.json()

        // return sendTransaction(ctx.wagmiConfig, {
        //   chain: 56,
        //   account: ctx.account,
        //   to: ensoResJson.tx.to,
        //   data: ensoResJson.tx.data as `0x${string}`,
        //   value: ensoResJson.tx.value
        // });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps: string[] = [];
    const { token, mode, earnPosition, prevEarnPosition } = ctx.request;

    if (mode === "add") {
      const allowance = await readContract(ctx.wagmiConfig, {
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account, CONTRACT_VAULT],
      });
      var amount = dn.sub(earnPosition.deposit, prevEarnPosition.deposit)

      console.log("allowance", allowance);
      console.log("amount",  amount[0])
      if (allowance < amount[0]) {
        steps.push("approve");
      }
      steps.push("deposit");
    }

    else {
      const allowance = await readContract(ctx.wagmiConfig, {
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account, CONTRACT_ROUTER],
      });
      var amount = dn.sub(prevEarnPosition.deposit, earnPosition.deposit)

      console.log("allowance", allowance);
      console.log("amount",  amount[0])
      if (allowance < amount[0]) {
        steps.push("approve");
      }


      const isOperator = await readContract(ctx.wagmiConfig, {
        address: CONTRACT_VAULT,
        abi: [{
          "inputs": [
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "",
              "type": "address"
            }
          ],
          "name": "isOperator",
          "outputs": [
            {
              "internalType": "bool",
              "name": "",
              "type": "bool"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }],
        functionName: "isOperator",
        args: [ctx.account, CONTRACT_ROUTER],
      });
      console.log("isOperator", isOperator);
      if (!isOperator) {
        steps.push("setOperator");
      }

      steps.push("withdraw");
    }

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};