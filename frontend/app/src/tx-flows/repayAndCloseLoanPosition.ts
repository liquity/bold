import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { getTroveId } from "@/src/liquity-utils";
import { vAddress } from "@/src/valibot-utils";
import * as v from "valibot";

const FlowIdSchema = v.literal("repayAndCloseLoanPosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  owner: vAddress(),
  ownerIndex: v.number(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

export const repayAndCloseLoanPosition: FlowDeclaration<Request> = {
  getSteps: async function getSteps(): Promise<["closeTrove"]> {
    return ["closeTrove"];
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
    if (stepId === "closeTrove") {
      const troveId = getTroveId(request.owner, request.ownerIndex);
      return {
        ...contracts.BorrowerOperations,
        functionName: "closeTrove" as const,
        args: [troveId],
      };
    }
    return null;
  },
};
