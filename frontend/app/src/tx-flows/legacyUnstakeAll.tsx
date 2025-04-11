import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Governance } from "@/src/abi/Governance";
import { Amount } from "@/src/comps/Amount/Amount";
import { LEGACY_CHECK } from "@/src/env";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContracts } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "legacyUnstakeAll",
  {
    lqtyAmount: vDnum(),
  },
);

export type LegacyUnstakeAllRequest = v.InferOutput<typeof RequestSchema>;

export const legacyUnstakeAll: FlowDeclaration<LegacyUnstakeAllRequest> = {
  title: "Withdraw from Legacy Stake",
  Summary: null,

  Details({ request }) {
    const lqtyPrice = usePrice("LQTY");
    return (
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
    );
  },

  steps: {
    // reset allocations
    resetAllocations: {
      name: () => "Reset Votes",
      Status: TransactionStatus,

      async commit(ctx) {
        if (!LEGACY_CHECK) {
          throw new Error("LEGACY_CHECK is not defined");
        }

        const initiativesFromSnapshotResult = await fetch(LEGACY_CHECK.INITIATIVES_SNAPSHOT_URL);
        const initiativesFromSnapshot = v.parse(
          v.array(vAddress()),
          await initiativesFromSnapshotResult.json(),
        );

        const lqtyAllocatedByUser = await readContracts(ctx.wagmiConfig, {
          contracts: initiativesFromSnapshot.map((initiative) => {
            if (!LEGACY_CHECK) {
              throw new Error("LEGACY_CHECK is not defined");
            }
            return {
              abi: Governance,
              address: LEGACY_CHECK.GOVERNANCE,
              functionName: "lqtyAllocatedByUserToInitiative",
              args: [ctx.account, initiative],
            } as const;
          }),
          allowFailure: false,
        });

        const allocatedInitiatives = lqtyAllocatedByUser
          .map((allocation, index) => {
            const [voteLQTY, _, vetoLQTY] = allocation;
            const initiative = initiativesFromSnapshot[index];
            if (!initiative) {
              throw new Error("initiative missing");
            }
            return voteLQTY > 0n || vetoLQTY > 0n ? initiative : null;
          })
          .filter((initiative) => initiative !== null);

        return ctx.writeContract({
          abi: Governance,
          address: LEGACY_CHECK.GOVERNANCE,
          functionName: "resetAllocations",
          args: [allocatedInitiatives, true],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    unstakeDeposit: {
      name: () => "Unstake",
      Status: TransactionStatus,

      async commit(ctx) {
        if (!LEGACY_CHECK) {
          throw new Error("LEGACY_CHECK is not defined");
        }
        return ctx.writeContract({
          abi: Governance,
          address: LEGACY_CHECK.GOVERNANCE,
          functionName: "withdrawLQTY",
          args: [ctx.request.lqtyAmount[0]],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps: string[] = [];

    if (!LEGACY_CHECK) {
      throw new Error("LEGACY_CHECK is not defined");
    }

    // check if the user has any allocations
    const [
      _unallocatedLQTY,
      _unallocatedOffset,
      allocatedLQTY,
    ] = await ctx.readContract({
      abi: Governance,
      address: LEGACY_CHECK.GOVERNANCE,
      functionName: "userStates",
      args: [ctx.account],
    });

    if (allocatedLQTY > 0n) {
      steps.push("resetAllocations");
    }

    steps.push("unstakeDeposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
