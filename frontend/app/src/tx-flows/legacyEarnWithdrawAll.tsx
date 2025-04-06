import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { StabilityPool } from "@/src/abi/StabilityPool";
import { Amount } from "@/src/comps/Amount/Amount";
import { LEGACY_CHECK } from "@/src/env";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum } from "@/src/valibot-utils";
import { Fragment } from "react";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "legacyEarnWithdrawAll",
  {
    pools: v.array(
      v.object({
        branchIndex: v.number(),
        deposit: vDnum(),
        rewards: v.object({
          bold: vDnum(),
          coll: vDnum(),
        }),
      }),
    ),
  },
);

export type LegacyEarnWithdrawAllRequest = v.InferOutput<typeof RequestSchema>;
type Step = FlowDeclaration<LegacyEarnWithdrawAllRequest>["steps"][number];

export const legacyEarnWithdrawAll: FlowDeclaration<LegacyEarnWithdrawAllRequest> = {
  title: "Withdraw from Legacy Earn Pools",
  Summary: null,
  Details({ request }) {
    return request.pools.map((pool) => {
      const branch = LEGACY_CHECK?.BRANCHES[pool.branchIndex];
      return (
        branch && (
          <Fragment key={pool.branchIndex}>
            <TransactionDetailsRow
              label={[
                `Withdraw deposit from ${branch?.name} pool`,
                (pool.rewards.coll[0] > 0n || pool.rewards.bold[0] > 0n)
                  ? "And claim rewards"
                  : null,
              ]}
              value={[
                <Amount
                  key="start"
                  suffix=" BOLD"
                  value={pool.deposit}
                />,
                pool.rewards.coll[0] > 0n
                  ? (
                    <Amount
                      key="middle"
                      value={pool.rewards.coll}
                      suffix={` ${branch.symbol}`}
                    />
                  )
                  : null,
                pool.rewards.bold[0] > 0n
                  ? (
                    <Amount
                      key="end"
                      value={pool.rewards.bold}
                      suffix=" BOLD"
                    />
                  )
                  : null,
              ]}
            />
          </Fragment>
        )
      );
    });
  },

  // doing this is easier than supporting dynamic steps,
  // since this is the only tx flow using them
  steps: LEGACY_CHECK
    ? {
      withdrawFromStabilityPool0: getWithdrawStep(0),
      withdrawFromStabilityPool1: getWithdrawStep(1),
      withdrawFromStabilityPool2: getWithdrawStep(2),
      withdrawFromStabilityPool3: getWithdrawStep(3),
      withdrawFromStabilityPool4: getWithdrawStep(4),
      withdrawFromStabilityPool5: getWithdrawStep(5),
      withdrawFromStabilityPool6: getWithdrawStep(6),
      withdrawFromStabilityPool7: getWithdrawStep(7),
      withdrawFromStabilityPool8: getWithdrawStep(8),
      withdrawFromStabilityPool9: getWithdrawStep(9),
    }
    : {},

  async getSteps({ request }) {
    return request.pools.map(
      (pool) => `withdrawFromStabilityPool${pool.branchIndex}`,
    );
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};

function getWithdrawStep(legacyBranchIndex: number): Step {
  const legacyBranch = LEGACY_CHECK?.BRANCHES[legacyBranchIndex];
  if (!legacyBranch) {
    if (legacyBranchIndex === 0) {
      throw new Error("Legacy branch not found");
    }
    return getWithdrawStep(0); // fallback to make the type checker happy
  }
  return {
    name: () => `Withdraw from ${legacyBranch.name} pool`,
    Status: TransactionStatus,
    async commit({ request, writeContract }) {
      const pool = request.pools.find((pool) => (
        pool.branchIndex === legacyBranchIndex
      ));
      if (!pool) {
        throw new Error("Pool not found");
      }
      return writeContract({
        abi: StabilityPool,
        address: legacyBranch.STABILITY_POOL,
        functionName: "withdrawFromSP",
        args: [pool.deposit[0], true],
      });
    },
    async verify(ctx, hash) {
      await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
    },
  };
}
