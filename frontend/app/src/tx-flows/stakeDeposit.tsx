import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { dnum18 } from "@/src/dnum-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("stakeDeposit");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  backLink: v.union([
    v.null(),
    v.tuple([
      v.string(), // path
      v.string(), // label
    ]),
  ]),
  successLink: v.tuple([
    v.string(), // path
    v.string(), // label
  ]),
  successMessage: v.string(),

  lqtyAmount: vDnum(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "stakeDeposit" | "approveLqty";

const stepNames: Record<Step, string> = {
  approveLqty: "Approve LQTY",
  stakeDeposit: "Stake",
};

export const stakeDeposit: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    console.log(flow);
    return null;
  },

  Details({ flow }) {
    const { request } = flow;
    const lqtyPrice = usePrice("LQTY");
    return (
      <>
        <TransactionDetailsRow
          label="You deposit"
          value={[
            <Amount value={request.lqtyAmount} suffix=" LQTY" />,
            <Amount value={lqtyPrice && dn.mul(request.lqtyAmount, lqtyPrice)} prefix="$" />,
          ]}
        />
      </>
    );
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    if (!account.address) {
      throw new Error("Account address is required");
    }

    const lqtyAllowance = await readContract(wagmiConfig, {
      ...contracts.LqtyToken,
      functionName: "allowance",
      args: [account.address, contracts.LqtyStaking.address],
    });

    const isLqtyApproved = dn.lte(request.lqtyAmount, dnum18(lqtyAllowance));

    return [
      isLqtyApproved ? null : "approveLqty" as const,
      "stakeDeposit" as const,
    ].filter((step): step is Step => step !== null);
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    if (stepId === "approveLqty") {
      return {
        ...contracts.LqtyToken,
        functionName: "approve",
        args: [contracts.LqtyStaking.address, request.lqtyAmount[0]],
      };
    }
    if (stepId === "stakeDeposit") {
      return {
        ...contracts.LqtyStaking,
        functionName: "stake",
        args: [request.lqtyAmount[0]],
      };
    }
    throw new Error(`Invalid stepId: ${stepId}`);
  },
};
