import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { getTroveId } from "@/src/liquity-utils";
import { vAddress, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("updateLoanPosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  collIndex: v.number(),
  owner: vAddress(),
  ownerIndex: v.number(),
  collChange: vDnum(),
  boldChange: vDnum(),
  maxUpfrontFee: vDnum(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

export const updateLoanPosition: FlowDeclaration<Request> = {
  getSteps: async function getSteps(): Promise<["adjustTrove"]> {
    return ["adjustTrove"];
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
    const { BorrowerOperations } = contracts.collaterals[request.collIndex];

    if (stepId === "adjustTrove") {
      const troveId = getTroveId(request.owner, request.ownerIndex);
      return {
        ...BorrowerOperations,
        functionName: "adjustTrove" as const,
        args: [
          troveId,
          request.collChange[0],
          !dn.lt(request.collChange, 0n),
          request.boldChange[0],
          !dn.lt(request.boldChange, 0n),
          request.maxUpfrontFee,
        ],
      };
    }
    return null;
  },
};
