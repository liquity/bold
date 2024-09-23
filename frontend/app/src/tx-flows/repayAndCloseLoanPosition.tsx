import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { getTroveId } from "@/src/liquity-utils";
import { vAddress } from "@/src/valibot-utils";
import * as v from "valibot";

const FlowIdSchema = v.literal("repayAndCloseLoanPosition");

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

  collIndex: v.number(),
  owner: vAddress(),
  ownerIndex: v.number(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

export const repayAndCloseLoanPosition: FlowDeclaration<Request> = {
  title: "",
  subtitle: "",
  Summary: () => null,
  Details: () => null,
  getStepName: () => "",

  getSteps: async function getSteps() {
    return ["closeTrove"];
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations } = collateral.contracts;

    if (!BorrowerOperations) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    if (stepId === "closeTrove") {
      const troveId = getTroveId(request.owner, request.ownerIndex);
      return {
        ...BorrowerOperations,
        functionName: "closeTrove" as const,
        args: [troveId],
      };
    }
    return null;
  },
};
