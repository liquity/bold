import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { Amount } from "@/src/comps/Amount/Amount";
import { LEGACY_CHECK, LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { dnum18, jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum } from "@/src/valibot-utils";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import * as v from "valibot";
import { createPublicClient, erc20Abi } from "viem";
import { http, useConfig as useWagmiConfig } from "wagmi";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "legacyRedeemCollateral",
  {
    amount: vDnum(),
    maxFee: vDnum(),
  },
);

export type LegacyRedeemCollateralRequest = v.InferOutput<typeof RequestSchema>;

export const legacyRedeemCollateral: FlowDeclaration<LegacyRedeemCollateralRequest> = {
  title: "Review & Send Transaction",
  Summary: () => null,
  Details(ctx) {
    const estimatedGains = useSimulatedBalancesChange(ctx);
    const boldChange = estimatedGains.data?.find(({ symbol }) => symbol === "BOLD")?.change;
    const collChanges = estimatedGains.data?.filter(({ symbol }) => symbol !== "BOLD");
    return (
      <>
        <TransactionDetailsRow
          label="Max fee"
          value={[
            <Amount
              key="start"
              value={ctx.request.maxFee}
              percentage
              format="pctfull"
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Reedeming BOLD"
          value={[
            <Amount
              key="start"
              value={boldChange}
              fallback="fetching…"
              suffix=" BOLD"
            />,
            <>Estimated BOLD that will be redeemed.</>,
          ]}
        />
        {LEGACY_CHECK?.BRANCHES.map(({ symbol }) => {
          const collChange = collChanges?.find((change) => symbol === change.symbol)?.change;
          const symbol_ = symbol === "ETH" ? "WETH" : symbol;
          return (
            <TransactionDetailsRow
              key={symbol}
              label={`Receiving ${symbol_}`}
              value={[
                <Amount
                  key="start"
                  value={collChange}
                  fallback="fetching…"
                  suffix={` ${symbol_}`}
                />,
                <>Estimated {symbol_} you will receive.</>,
              ]}
            />
          );
        })}
      </>
    );
  },
  steps: {
    approve: {
      name: () => "Approve BOLD",
      Status: TransactionStatus,
      async commit({ request, writeContract }) {
        if (!LEGACY_CHECK) {
          throw new Error("LEGACY_CHECK is not defined");
        }
        return writeContract({
          abi: erc20Abi,
          address: LEGACY_CHECK.BOLD_TOKEN,
          functionName: "approve",
          args: [LEGACY_CHECK.COLLATERAL_REGISTRY, request.amount[0]],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
    redeemCollateral: {
      name: () => "Redeem BOLD",
      Status: TransactionStatus,
      async commit({ request, writeContract }) {
        if (!LEGACY_CHECK) {
          throw new Error("LEGACY_CHECK is not defined");
        }
        return writeContract({
          abi: CollateralRegistry,
          address: LEGACY_CHECK.COLLATERAL_REGISTRY,
          functionName: "redeemCollateral",
          args: [
            request.amount[0],
            0n,
            request.maxFee[0],
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    if (!LEGACY_CHECK) {
      throw new Error("LEGACY_CHECK is not defined");
    }

    const steps = [];

    // check for allowance
    const boldAllowance = await ctx.readContract({
      abi: erc20Abi,
      address: LEGACY_CHECK.BOLD_TOKEN,
      functionName: "allowance",
      args: [ctx.account, LEGACY_CHECK.COLLATERAL_REGISTRY],
    });

    if (dn.gt(ctx.request.amount, dnum18(boldAllowance))) {
      steps.push("approve");
    }

    steps.push("redeemCollateral");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};

export const StoredBalancesChangeSchema = v.object({
  stringifiedRequest: v.string(),
  balanceChanges: v.array(v.object({
    symbol: v.string(),
    change: vDnum(),
  })),
});

export function useSimulatedBalancesChange({
  account,
  request,
}: {
  account: Address;
  request: LegacyRedeemCollateralRequest;
}) {
  const wagmiConfig = useWagmiConfig();
  return useQuery({
    queryKey: ["simulatedBalancesChange", account, jsonStringifyWithDnum(request)],
    queryFn: async () => {
      if (!LEGACY_CHECK) {
        throw new Error("LEGACY_CHECK is not defined");
      }

      let stored: v.InferOutput<typeof StoredBalancesChangeSchema> | null = null;
      try {
        stored = v.parse(
          StoredBalancesChangeSchema,
          jsonParseWithDnum(
            localStorage.getItem(
              `${LOCAL_STORAGE_PREFIX}:simulatedBalancesChange`,
            ) ?? "",
          ),
        );
      } catch (_) {}

      if (stored && stored.stringifiedRequest === jsonStringifyWithDnum(request)) {
        return stored.balanceChanges;
      }

      const [chain] = wagmiConfig.chains;
      const [rpcUrl] = chain.rpcUrls.default.http;
      const client = createPublicClient({ chain, transport: http(rpcUrl) });

      const branchesBalanceCalls = LEGACY_CHECK.BRANCHES.map((branch) => ({
        to: branch.COLL_TOKEN,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [account],
      } as const));

      const boldBalanceCall = {
        to: LEGACY_CHECK.BOLD_TOKEN,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [account],
      } as const;

      const simulation = await client.simulateCalls({
        account,
        calls: [
          boldBalanceCall,
          ...branchesBalanceCalls,
          {
            to: LEGACY_CHECK.COLLATERAL_REGISTRY,
            abi: CollateralRegistry,
            functionName: "redeemCollateral",
            args: [request.amount[0], 0n, request.maxFee[0]],
          },
          boldBalanceCall,
          ...branchesBalanceCalls,
        ],
      });

      const getBalancesFromSimulated = (position: number) => {
        if (!LEGACY_CHECK) {
          throw new Error("LEGACY_CHECK is not defined");
        }
        return simulation.results
          .slice(position, position + LEGACY_CHECK.BRANCHES.length + 1)
          .map((result, index) => {
            if (!LEGACY_CHECK) {
              throw new Error("LEGACY_CHECK is not defined");
            }
            const symbol = index === 0 ? "BOLD" : LEGACY_CHECK.BRANCHES[index - 1]?.symbol;
            return {
              symbol,
              balance: dnum18(result.data ?? 0n),
            };
          });
      };

      const balancesBefore = getBalancesFromSimulated(0);
      const balancesAfter = getBalancesFromSimulated(LEGACY_CHECK.BRANCHES.length + 2);

      const balanceChanges = balancesBefore.map((balanceBefore, index) => {
        const balanceAfter = balancesAfter[index];
        if (!balanceAfter) throw new Error();
        return {
          symbol: balanceBefore.symbol,
          change: dn.sub(balanceAfter.balance, balanceBefore.balance),
        };
      });

      localStorage.setItem(
        `${LOCAL_STORAGE_PREFIX}:simulatedBalancesChange`,
        jsonStringifyWithDnum({
          stringifiedRequest: jsonStringifyWithDnum(request),
          balanceChanges,
        }),
      );

      return balanceChanges;
    },
  });
}
