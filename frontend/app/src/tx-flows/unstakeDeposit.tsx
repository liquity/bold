import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("unstakeDeposit");

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

type Step = "unstakeDeposit";

const stepNames: Record<Step, string> = {
  unstakeDeposit: "Unstake",
};

export const unstakeDeposit: FlowDeclaration<Request, Step> = {
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
          label="You withdraw"
          value={[
            <Amount value={request.lqtyAmount} suffix=" LQTY" />,
            <Amount value={lqtyPrice && dn.mul(request.lqtyAmount, lqtyPrice)} prefix="$" />,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["unstakeDeposit"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    if (stepId === "unstakeDeposit") {
      return {
        ...contracts.LqtyStaking,
        functionName: "unstake",
        args: [request.lqtyAmount[0]],
      };
    }
    throw new Error(`Invalid stepId: ${stepId}`);
  },
};
