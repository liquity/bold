import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { fmtnum } from "@/src/formatting";
import { getCollToken } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import { ADDRESS_ZERO } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { parseEventLogs } from "viem";

const FlowIdSchema = v.literal("openLeveragePosition");

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
  owner: vAddress(),
  ownerIndex: v.number(),
  collAmount: vDnum(),
  boldAmount: vDnum(),
  upperHint: vDnum(),
  lowerHint: vDnum(),
  annualInterestRate: vDnum(),
  maxUpfrontFee: vDnum(),
  flashLoanAmount: vDnum(), // Added for leverage
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "openLeveragedTrove";

const stepNames: Record<Step, string> = {
  openLeveragedTrove: "Open Leveraged Position",
};

export const openLeveragePosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const collateral = getCollToken(flow.request.collIndex);
    return collateral && (
      <LoanCard
        leverageMode={true}
        loadingState="success"
        loan={{
          troveId: "0x",
          batchManager: null,
          borrower: flow.request.owner,
          borrowed: flow.request.boldAmount,
          collIndex: flow.request.collIndex,
          deposit: flow.request.collAmount,
          interestRate: flow.request.annualInterestRate,
          type: "borrow",
        }}
        onRetry={() => {}}
        txPreviewMode
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const collateral = getCollToken(flow.request.collIndex);
    const collPrice = usePrice(collateral?.symbol ?? null);
    const boldPrice = usePrice("BOLD");

    const totalCollateral = dn.add(request.collAmount, request.flashLoanAmount);

    return collateral && (
      <>
        <TransactionDetailsRow
          label="Leveraged deposit"
          value={[
            `${fmtnum(totalCollateral)} ${collateral.name}`,
            collPrice && `$${fmtnum(dn.mul(totalCollateral, collPrice))}`,
          ]}
        />
        <TransactionDetailsRow
          label="Borrowed BOLD"
          value={[
            `${fmtnum(request.boldAmount)} BOLD`,
            boldPrice && `$${fmtnum(dn.mul(request.boldAmount, boldPrice))}`,
          ]}
        />
        <TransactionDetailsRow
          label="Interest rate"
          value={[
            `${fmtnum(request.annualInterestRate, 2, 100)}%`,
            `${fmtnum(dn.mul(request.boldAmount, request.annualInterestRate))} BOLD per year`,
          ]}
        />
        <TransactionDetailsRow
          label="Refundable gas deposit"
          value={[
            <div title={`${fmtnum(ETH_GAS_COMPENSATION, "full")} ETH`}>
              {fmtnum(ETH_GAS_COMPENSATION, 4)} ETH
            </div>,
            "Only used in case of liquidation",
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["openLeveragedTrove"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  parseReceipt(stepId, receipt, { request, contracts }): string | null {
    const collateral = contracts.collaterals[request.collIndex];
    if (stepId === "openLeveragedTrove") {
      const [troveOperation] = parseEventLogs({
        abi: collateral.contracts.TroveManager.abi,
        logs: receipt.logs,
        eventName: "TroveOperation",
      });
      if (troveOperation) {
        return "0x" + (troveOperation.args._troveId.toString(16));
      }
    }
    return null;
  },

  async writeContractParams(stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.collIndex];

    // LeverageWETHZapper
    if (collateral.symbol === "ETH" && stepId === "openLeveragedTrove") {
      return {
        ...collateral.contracts.LeverageWETHZapper,
        functionName: "openLeveragedTroveWithRawETH" as const,
        args: [{
          owner: request.owner ?? ADDRESS_ZERO,
          ownerIndex: BigInt(request.ownerIndex),
          collAmount: request.collAmount[0],
          boldAmount: request.boldAmount[0],
          upperHint: request.upperHint[0],
          lowerHint: request.lowerHint[0],
          annualInterestRate: request.annualInterestRate[0],
          batchManager: ADDRESS_ZERO,
          maxUpfrontFee: request.maxUpfrontFee[0],
          addManager: ADDRESS_ZERO,
          removeManager: ADDRESS_ZERO,
          receiver: ADDRESS_ZERO,
          flashLoanAmount: request.flashLoanAmount[0],
        }],
        value: request.collAmount[0] + ETH_GAS_COMPENSATION[0],
      };
    }

    // LeverageLSTZapper
    if (stepId === "openLeveragedTrove") {
      return {
        ...collateral.contracts.LeverageLSTZapper,
        functionName: "openLeveragedTroveWithRawETH" as const,
        args: [{
          owner: request.owner ?? ADDRESS_ZERO,
          ownerIndex: BigInt(request.ownerIndex),
          collAmount: request.collAmount[0],
          boldAmount: request.boldAmount[0],
          upperHint: request.upperHint[0],
          lowerHint: request.lowerHint[0],
          annualInterestRate: request.annualInterestRate[0],
          batchManager: ADDRESS_ZERO,
          maxUpfrontFee: request.maxUpfrontFee[0],
          addManager: ADDRESS_ZERO,
          removeManager: ADDRESS_ZERO,
          receiver: ADDRESS_ZERO,
          flashLoanAmount: request.flashLoanAmount[0],
        }],
        value: ETH_GAS_COMPENSATION[0],
      };
    }

    throw new Error("Not implemented");
  },
};
