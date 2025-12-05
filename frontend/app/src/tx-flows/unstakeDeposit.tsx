import type { UserAllocation, UserState } from "@/src/liquity-governance";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { getUserAllocations, getUserStates } from "@/src/liquity-governance";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { Abi, encodeFunctionData } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

function calculateUnstakingStrategy(
  userState: UserState,
  userAllocations: UserAllocation[],
  unstakeAmount: bigint,
): {
  needsReallocation: boolean;
  newAllocations?: Record<Address, { amount: bigint; vote: "for" | "against" }>;
  withdrawFromUnallocated: bigint;
  remainingStakedLQTY: bigint;
} {
  const { unallocatedLQTY, stakedLQTY } = userState;
  const remainingStakedLQTY = stakedLQTY - unstakeAmount;
  const hasAllocations = userAllocations.length > 0;

  // Simple case: no allocations or sufficient unallocated LQTY
  if (!hasAllocations || unallocatedLQTY >= unstakeAmount) {
    return {
      needsReallocation: false,
      withdrawFromUnallocated: unstakeAmount,
      remainingStakedLQTY,
    };
  }

  // Complex case: need to reallocate with preserved percentages
  const totalAllocatedLQTY = userAllocations.reduce(
    (sum, alloc) => sum + alloc.voteLQTY + alloc.vetoLQTY,
    0n,
  );

  const allocationEntries = userAllocations
    .map((alloc) => {
      const allocatedAmount = alloc.voteLQTY + alloc.vetoLQTY;
      const percentage = (allocatedAmount * 10n ** 18n) / totalAllocatedLQTY;
      return {
        address: alloc.initiative,
        percentage,
        vote: alloc.voteLQTY > alloc.vetoLQTY ? "for" as const : "against" as const,
      };
    })
    .filter(({ percentage }) => percentage > 0n)
    .sort((a, b) => a.percentage > b.percentage ? -1 : 1);

  let remainingLQTY = remainingStakedLQTY;
  let remainingPercentage = allocationEntries.reduce((sum, { percentage }) => sum + percentage, 0n);
  const newAllocations: Record<Address, { amount: bigint; vote: "for" | "against" }> = {};

  for (const entry of allocationEntries) {
    const { address, percentage, vote } = entry;
    const amount = remainingLQTY * percentage / remainingPercentage;

    newAllocations[address] = { amount, vote };
    remainingLQTY -= amount;
    remainingPercentage -= percentage;
  }

  return {
    needsReallocation: true,
    newAllocations,
    withdrawFromUnallocated: unallocatedLQTY,
    remainingStakedLQTY,
  };
}

const RequestSchema = createRequestSchema(
  "unstakeDeposit",
  {
    lqtyAmount: vDnum(),
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type UnstakeDepositRequest = v.InferOutput<typeof RequestSchema>;

function generateUnstakeTransactions(
  userState: UserState,
  userAllocations: UserAllocation[],
  unstakeAmount: bigint,
  governanceAbi: Abi,
) {
  const inputs: `0x${string}`[] = [];
  const allocatedInitiatives = userAllocations
    .filter(({ voteLQTY, vetoLQTY }) => (voteLQTY + vetoLQTY) > 0n)
    .map(({ initiative }) => initiative);

  const isFullUnstake = unstakeAmount === userState.stakedLQTY;

  if (userAllocations.length > 0) {
    if (isFullUnstake) {
      inputs.push(encodeFunctionData({
        abi: governanceAbi,
        functionName: "resetAllocations",
        args: [allocatedInitiatives, true],
      }));
    } else {
      const strategy = calculateUnstakingStrategy(userState, userAllocations, unstakeAmount);
      if (strategy.needsReallocation && strategy.newAllocations) {
        const initiativeAddresses = Object.keys(strategy.newAllocations) as Address[];
        const [votes, vetos] = initiativeAddresses.reduce(
          ([v, ve], address, index) => {
            const allocation = strategy.newAllocations![address];
            if (!allocation) return [v, ve];
            if (allocation.vote === "for") {
              v[index] = allocation.amount;
            } else if (allocation.vote === "against") {
              ve[index] = allocation.amount;
            }
            return [v, ve];
          },
          [
            Array.from<bigint>({ length: initiativeAddresses.length }).fill(0n),
            Array.from<bigint>({ length: initiativeAddresses.length }).fill(0n),
          ],
        );

        inputs.push(encodeFunctionData({
          abi: governanceAbi,
          functionName: "allocateLQTY",
          args: [allocatedInitiatives, initiativeAddresses, votes, vetos],
        }));
        // else: Partial unstake with enough unallocated LQTY - preserve allocations
      }
    }
  }

  inputs.push(encodeFunctionData({
    abi: governanceAbi,
    functionName: "withdrawLQTY",
    args: [unstakeAmount],
  }));

  return inputs;
}

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
    const isFullUnstake = dn.eq(request.lqtyAmount, request.stakePosition.deposit);

    return (
      <TransactionDetailsRow
        label={[
          "You withdraw",
          isFullUnstake
            ? "Your voting power will be reset."
            : "Voting allocations will be preserved proportionally.",
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
        const unstakeAmount = ctx.request.lqtyAmount[0];

        let [userState, userAllocations] = await Promise.all([
          getUserStates(ctx.wagmiConfig, ctx.account),
          getUserAllocations(ctx.wagmiConfig, ctx.account),
        ]);

        // Degraded mode check: user has allocations but we couldn't fetch them (both the graph & api are down)
        // In this mode, we can only unstake what has not been allocated.
        const votingAllocationsFetchError = userState.allocatedLQTY > 0n && userAllocations.length === 0;
        if (votingAllocationsFetchError) {
          if (userState.unallocatedLQTY < unstakeAmount) {
            throw new Error(
              "API error: your voting allocations could not be fetched. "
                + "Please try again later or manually reset your voting allocations first.",
            );
          }
        }

        const inputs = generateUnstakeTransactions(
          userState,
          userAllocations,
          unstakeAmount,
          Governance.abi,
        );

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
