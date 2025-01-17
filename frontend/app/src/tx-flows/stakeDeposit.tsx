import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import { dnum18 } from "@/src/dnum-utils";
import { signPermit } from "@/src/permit";
import { PermissionStatus } from "@/src/screens/TransactionsScreen/PermissionStatus";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { GovernanceUserAllocated, graphQuery } from "@/src/subgraph-queries";
import { vDnum, vPositionStake } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { getBytecode, readContract, writeContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "stakeDeposit",
  {
    lqtyAmount: vDnum(),
    stakePosition: vPositionStake(),
    prevStakePosition: v.union([v.null(), vPositionStake()]),
  },
);

export type StakeDepositRequest = v.InferOutput<typeof RequestSchema>;

const USE_PERMIT = true;

export const stakeDeposit: FlowDeclaration<StakeDepositRequest> = {
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
    return (
      <TransactionDetailsRow
        label="You deposit"
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
    deployUserProxy: {
      name: () => "Initialize Staking",
      Status: TransactionStatus,

      async commit({ account, contracts, wagmiConfig }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        return writeContract(wagmiConfig, {
          ...contracts.Governance,
          functionName: "deployUserProxy",
        });
      },

      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    // reset allocations
    resetAllocations: {
      name: () => "Reset Allocations",
      Status: TransactionStatus,

      async commit({ account, contracts, wagmiConfig }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        const allocated = await graphQuery(
          GovernanceUserAllocated,
          { id: account.toLowerCase() },
        );

        return writeContract(wagmiConfig, {
          ...contracts.Governance,
          functionName: "resetAllocations",
          args: [(allocated.governanceUser?.allocated ?? []) as Address[], true],
        });
      },

      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    // approve via permit
    permitLqty: {
      name: () => "Approve LQTY",
      Status: PermissionStatus,

      async commit({ account, contracts, request, wagmiConfig }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        const { LqtyToken, Governance } = contracts;

        const userProxyAddress = await readContract(wagmiConfig, {
          ...Governance,
          functionName: "deriveUserProxyAddress",
          args: [account],
        });

        const { deadline, ...permit } = await signPermit({
          token: LqtyToken.address,
          spender: userProxyAddress,
          value: request.lqtyAmount[0],
          account,
          wagmiConfig,
        });

        return JSON.stringify({
          ...permit,
          deadline: Number(deadline),
          userProxyAddress,
        });
      },

      async verify() {
        // nothing to do
      },
    },

    // approve tx
    approveLqty: {
      name: () => "Approve LQTY",
      Status: TransactionStatus,

      async commit({ account, contracts, request, wagmiConfig }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        const { LqtyToken, Governance } = contracts;

        const userProxyAddress = await readContract(wagmiConfig, {
          ...Governance,
          functionName: "deriveUserProxyAddress",
          args: [account],
        });

        return writeContract(wagmiConfig, {
          ...LqtyToken,
          functionName: "approve",
          args: [userProxyAddress, request.lqtyAmount[0]],
        });
      },

      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    stakeDeposit: {
      name: () => "Stake",
      Status: TransactionStatus,

      async commit({ account, contracts, request, wagmiConfig, steps }) {
        if (!account) {
          throw new Error("Account address is required");
        }

        // deposit approved LQTY
        if (!USE_PERMIT) {
          return writeContract(wagmiConfig, {
            ...contracts.Governance,
            functionName: "depositLQTY",
            args: [request.lqtyAmount[0]],
          });
        }

        // deposit LQTY via permit
        const permitStep = steps?.find((step) => step.id === "permitLqty");
        const { userProxyAddress, ...permit } = JSON.parse(permitStep?.artifact ?? "");

        return writeContract(wagmiConfig, {
          ...contracts.Governance,
          functionName: "depositLQTYViaPermit",
          args: [
            request.lqtyAmount[0],
            {
              owner: account,
              spender: userProxyAddress,
              value: request.lqtyAmount[0],
              deadline: permit.deadline,
              v: permit.v,
              r: permit.r,
              s: permit.s,
            },
          ],
        });
      },

      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    if (!account) {
      throw new Error("Account address is required");
    }

    const steps: string[] = [];

    // check if the user has any allocations
    const allocated = await graphQuery(
      GovernanceUserAllocated,
      { id: account.toLowerCase() },
    );
    if (
      allocated.governanceUser
      && allocated.governanceUser.allocated.length > 0
    ) {
      steps.push("resetAllocations");
    }

    // get the user proxy address
    const userProxyAddress = await readContract(wagmiConfig, {
      ...contracts.Governance,
      functionName: "deriveUserProxyAddress",
      args: [account],
    });

    // check if the user proxy contract exists
    const userProxyBytecode = await getBytecode(wagmiConfig, {
      address: userProxyAddress,
    });

    // deploy the user proxy (optional, but prevents wallets
    // to show a warning for approving a non-deployed contract)
    if (!userProxyBytecode) {
      steps.push("deployUserProxy");
    }

    // approve via permit
    if (USE_PERMIT) {
      return [
        ...steps,
        "permitLqty",
        "stakeDeposit",
      ];
    }

    // check for allowance
    const lqtyAllowance = await readContract(wagmiConfig, {
      ...contracts.LqtyToken,
      functionName: "allowance",
      args: [account, userProxyAddress],
    });

    // approve
    if (dn.gt(request.lqtyAmount, dnum18(lqtyAllowance))) {
      steps.push("approveLqty");
    }

    // stake
    steps.push("stakeDeposit");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
