import type { InitiativeState, UserAllocation, UserState } from "@/src/liquity-governance";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { getInitiativesStates, getUserAllocations, getUserStates } from "@/src/liquity-governance";
import { isInitiativeStatusActive } from "@/src/screens/StakeScreen/utils";
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
  nonZeroAllocations: UserAllocation[],
  unstakeAmount: bigint,
  initiativesStates: InitiativeState,
): {
  needsReallocation: boolean;
  needsResetOnly: boolean;
  newAllocations?: Record<Address, { amount: bigint; vote: "for" | "against" }>;
} {
  const { unallocatedLQTY, stakedLQTY } = userState;
  const remainingStakedLQTY = stakedLQTY - unstakeAmount;
  const hasAllocations = nonZeroAllocations.length > 0;

  // Simple case: no allocations or sufficient unallocated LQTY
  if (!hasAllocations || unallocatedLQTY >= unstakeAmount) {
    return {
      needsReallocation: false,
      needsResetOnly: false,
    };
  }

  const activeAllocations = nonZeroAllocations.filter((alloc) => {
    const state = initiativesStates[alloc.initiative];
    return state && isInitiativeStatusActive(state.status);
  });

  if (activeAllocations.length === 0) {
    return {
      needsReallocation: false,
      needsResetOnly: true,
    };
  }

  const activeAllocatedTotal = activeAllocations.reduce(
    (sum, alloc) => sum + alloc.voteLQTY + alloc.vetoLQTY,
    0n,
  );

  const needsScaling = remainingStakedLQTY < activeAllocatedTotal;
  const newAllocations: Record<Address, { amount: bigint; vote: "for" | "against" }> = {};

  for (const alloc of activeAllocations) {
    const previousLQTY = alloc.voteLQTY + alloc.vetoLQTY;
    const amount = needsScaling
      ? (previousLQTY * remainingStakedLQTY) / activeAllocatedTotal
      : previousLQTY;
    newAllocations[alloc.initiative] = {
      amount,
      vote: alloc.voteLQTY > alloc.vetoLQTY ? "for" : "against",
    };
  }

  return {
    needsReallocation: true,
    needsResetOnly: false,
    newAllocations,
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
  nonZeroAllocations: UserAllocation[],
  unstakeAmount: bigint,
  initiativesStates: InitiativeState,
  governanceAbi: Abi,
) {
  const inputs: `0x${string}`[] = [];
  const allocatedInitiatives = nonZeroAllocations.map(({ initiative }) => initiative);

  const isFullUnstake = unstakeAmount === userState.stakedLQTY;

  if (nonZeroAllocations.length > 0) {
    const strategy = isFullUnstake ? null : calculateUnstakingStrategy(
      userState,
      nonZeroAllocations,
      unstakeAmount,
      initiativesStates,
    );

    if (isFullUnstake || strategy?.needsResetOnly) {
      inputs.push(encodeFunctionData({
        abi: governanceAbi,
        functionName: "resetAllocations",
        args: [allocatedInitiatives, true],
      }));
    } else if (strategy?.needsReallocation && strategy.newAllocations) {
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
            : "Voting allocations may be adjusted to fit your remaining stake.",
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
              "Your voting allocations could not be fetched. "
                + "Please try again later or manually reset your voting allocations first.",
            );
          }
        }

        const nonZeroAllocations = userAllocations.filter(
          ({ voteLQTY, vetoLQTY }) => (voteLQTY + vetoLQTY) > 0n,
        );
        const allocatedInitiativeAddresses = nonZeroAllocations.map(({ initiative }) => initiative);

        const isFullUnstake = unstakeAmount === userState.stakedLQTY;
        const needsInitiativesStates = !isFullUnstake
          && allocatedInitiativeAddresses.length > 0
          && userState.unallocatedLQTY < unstakeAmount;

        const initiativesStates: InitiativeState = needsInitiativesStates
          ? await getInitiativesStates(ctx.wagmiConfig, allocatedInitiativeAddresses)
          : {};

        const initiativesStatesFetchError = needsInitiativesStates
          && allocatedInitiativeAddresses.some((address) => !initiativesStates[address]);
        if (initiativesStatesFetchError) {
          throw new Error(
            "Initiative states could not be fetched. "
              + "Please try again later or manually reset your voting allocations first.",
          );
        }

        const inputs = generateUnstakeTransactions(
          userState,
          nonZeroAllocations,
          unstakeAmount,
          initiativesStates,
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
