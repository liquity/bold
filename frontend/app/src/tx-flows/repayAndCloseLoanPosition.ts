import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { getCollateralContracts } from "@/src/contracts";
import { getTroveId } from "@/src/liquity-utils";
import { vAddress } from "@/src/valibot-utils";
import * as v from "valibot";

const FlowIdSchema = v.literal("repayAndCloseLoanPosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  collIndex: v.number(),
  owner: vAddress(),
  ownerIndex: v.number(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

export const repayAndCloseLoanPosition: FlowDeclaration<Request> = {
  getSteps: async function getSteps() {
    return ["closeTrove"];
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
    const collSymbol = contracts.collaterals[request.collIndex][0];
    const { BorrowerOperations } = getCollateralContracts(collSymbol, contracts.collaterals) ?? {};

    if (!BorrowerOperations) {
      throw new Error(`Collateral ${collSymbol} not supported`);
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
