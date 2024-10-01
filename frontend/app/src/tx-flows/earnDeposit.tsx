import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("earnDeposit");

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

  collIndex: vCollIndex(),
  depositor: vAddress(),
  boldAmount: vDnum(),
  claim: v.boolean(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "provideToStabilityPool";

const stepNames: Record<Step, string> = {
  provideToStabilityPool: "Add deposit",
};

export const earnDeposit: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  subtitle: "Please review your borrow position before confirming",

  Summary() {
    // const { symbol } = useCollateral(flow.request.collIndex);
    return (
      null
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const boldPrice = usePrice("BOLD");
    return (
      <>
        <TransactionDetailsRow
          label="You deposit"
          value={[
            <Amount value={request.boldAmount} suffix=" BOLD" />,
            <Amount value={boldPrice && dn.mul(request.boldAmount, boldPrice)} prefix="$" />,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["provideToStabilityPool"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(_stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.collIndex];

    return {
      ...collateral.contracts.StabilityPool,
      functionName: "provideToSP",
      args: [
        request.boldAmount[0],
        request.claim,
      ],
    };
  },
};
