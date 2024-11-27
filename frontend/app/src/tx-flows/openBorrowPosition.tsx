import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import {
  getCollToken,
  getPrefixedTroveId,
  usePredictOpenTroveUpfrontFee,
} from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { isTroveId } from "@/src/types";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import {
  ADDRESS_ZERO,
  COLLATERALS as KNOWN_COLLATERALS,
  shortenAddress,
} from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { parseEventLogs } from "viem";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("openBorrowPosition");

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
  interestRateDelegate: v.union([
    v.null(),
    v.tuple([
      vAddress(), // delegate
      vDnum(), // min interest rate
      vDnum(), // max interest rate
    ]),
  ]),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "approveLst" | "openTroveEth" | "openTroveLst";

export const openBorrowPosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const { request } = flow;

    const upfrontFee = usePredictOpenTroveUpfrontFee(
      request.collIndex,
      request.boldAmount,
      request.interestRateDelegate?.[0] ?? request.annualInterestRate
    );
    const boldAmountWithFee =
      upfrontFee.data && dn.add(request.boldAmount, upfrontFee.data);

    return (
      <LoanCard
        leverageMode={false}
        loadingState='success'
        loan={{
          type: "borrow",
          status: "active",
          troveId: null,
          borrower: request.owner,
          batchManager: request.interestRateDelegate?.[0] ?? null,
          borrowed: boldAmountWithFee ?? dnum18(0),
          collIndex: request.collIndex,
          deposit: request.collAmount,
          interestRate: request.annualInterestRate,
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

    const upfrontFee = usePredictOpenTroveUpfrontFee(
      request.collIndex,
      request.boldAmount,
      request.interestRateDelegate?.[0] ?? request.annualInterestRate
    );
    const boldAmountWithFee =
      upfrontFee.data && dn.add(request.boldAmount, upfrontFee.data);

    return (
      collateral && (
        <>
          <TransactionDetailsRow
            label='Collateral'
            value={[
              `${fmtnum(request.collAmount)} ${collateral.name}`,
              <Amount
                key='end'
                fallback='…'
                prefix='$'
                value={collPrice && dn.mul(request.collAmount, collPrice)}
              />,
            ]}
          />
          <TransactionDetailsRow
            label='Loan'
            value={[
              <Amount
                key='start'
                fallback='…'
                value={boldAmountWithFee}
                suffix=' USDN'
              />,
              <Amount
                key='end'
                fallback='…'
                prefix='Incl. '
                value={upfrontFee.data}
                suffix=' USDN interest rate adjustment fee'
              />,
            ]}
          />
          <TransactionDetailsRow
            label='Interest rate'
            value={[
              <Amount
                key='start'
                value={request.annualInterestRate}
                percentage
              />,
              <Amount
                key='end'
                fallback='…'
                value={
                  boldAmountWithFee &&
                  dn.mul(boldAmountWithFee, request.annualInterestRate)
                }
                suffix=' USDN per year'
              />,
            ]}
          />
          {request.interestRateDelegate && (
            <TransactionDetailsRow
              label='Interest rate delegate'
              value={[
                <span key='start' title={request.interestRateDelegate[0]}>
                  {shortenAddress(request.interestRateDelegate[0], 4)}
                </span>,
              ]}
            />
          )}
          <TransactionDetailsRow
            label='Refundable gas deposit'
            value={[
              <div
                key='start'
                title={`${fmtnum(ETH_GAS_COMPENSATION, "full")} ETH`}
              >
                {fmtnum(ETH_GAS_COMPENSATION, 4)} ETH
              </div>,
              "Only used in case of liquidation",
            ]}
          />
        </>
      )
    );
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const collateral = contracts.collaterals[request.collIndex];

    if (collateral.symbol === "ETH") {
      return ["openTroveEth"];
    }

    const { LeverageLSTZapper, CollToken } = collateral.contracts;

    if (!LeverageLSTZapper || !CollToken) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    const allowance = dnum18(
      await readContract(wagmiConfig, {
        ...CollToken,
        functionName: "allowance",
        args: [account.address ?? ADDRESS_ZERO, LeverageLSTZapper.address],
      })
    );

    const isApproved = !dn.gt(
      dn.add(request.collAmount, ETH_GAS_COMPENSATION),
      allowance
    );

    const steps: Step[] = [];

    if (!isApproved) {
      steps.push("approveLst");
    }

    steps.push("openTroveLst");

    return steps;
  },

  getStepName(stepId, { contracts, request }) {
    const { symbol } = contracts.collaterals[request.collIndex];
    const collateral = KNOWN_COLLATERALS.find((c) => c.symbol === symbol);
    if (stepId === "approveLst") {
      return `Approve ${collateral?.name ?? ""}`;
    }
    return `Open loan`;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  parseReceipt(stepId, receipt, { request, contracts }): string | null {
    const collateral = contracts.collaterals[request.collIndex];

    if (stepId === "openTroveEth" || stepId === "openTroveLst") {
      const [troveOperation] = parseEventLogs({
        abi: collateral.contracts.TroveManager.abi,
        logs: receipt.logs,
        eventName: "TroveOperation",
      });
      if (troveOperation) {
        return "0x" + troveOperation.args._troveId.toString(16);
      }
    }

    return null;
  },

  async writeContractParams(stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.collIndex];

    const { LeverageLSTZapper, CollToken } = collateral.contracts;
    if (!LeverageLSTZapper || !CollToken) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    if (stepId === "approveLst") {
      return {
        ...CollToken,
        functionName: "approve" as const,
        args: [LeverageLSTZapper.address, request.collAmount[0]],
      };
    }

    // LeverageWETHZapper mode
    if (stepId === "openTroveEth") {
      return {
        ...collateral.contracts.LeverageWETHZapper,
        functionName: "openTroveWithRawETH" as const,
        args: [
          {
            owner: request.owner ?? ADDRESS_ZERO,
            ownerIndex: BigInt(request.ownerIndex),
            collAmount: 0n,
            boldAmount: request.boldAmount[0],
            upperHint: request.upperHint[0],
            lowerHint: request.lowerHint[0],
            annualInterestRate: request.interestRateDelegate
              ? 0n
              : request.annualInterestRate[0],
            batchManager: request.interestRateDelegate
              ? request.interestRateDelegate[0]
              : ADDRESS_ZERO,
            maxUpfrontFee: request.maxUpfrontFee[0],
            addManager: ADDRESS_ZERO,
            removeManager: ADDRESS_ZERO,
            receiver: ADDRESS_ZERO,
          },
        ],
        value: request.collAmount[0] + ETH_GAS_COMPENSATION[0],
      };
    }

    // LeverageLSTZapper mode
    if (stepId === "openTroveLst") {
      return {
        ...collateral.contracts.LeverageLSTZapper,
        functionName: "openTroveWithRawETH" as const,
        args: [
          {
            owner: request.owner ?? ADDRESS_ZERO,
            ownerIndex: BigInt(request.ownerIndex),
            collAmount: request.collAmount[0],
            boldAmount: request.boldAmount[0],
            upperHint: request.upperHint[0],
            lowerHint: request.lowerHint[0],
            annualInterestRate: request.interestRateDelegate
              ? 0n
              : request.annualInterestRate[0],
            batchManager: request.interestRateDelegate
              ? request.interestRateDelegate[0]
              : ADDRESS_ZERO,
            maxUpfrontFee: request.maxUpfrontFee[0],
            addManager: ADDRESS_ZERO,
            removeManager: ADDRESS_ZERO,
            receiver: ADDRESS_ZERO,
          },
        ],
        value: ETH_GAS_COMPENSATION[0],
      };
    }

    throw new Error("Not implemented");
  },

  async postFlowCheck({ request, steps }) {
    const lastStep = steps?.at(-1);

    if (
      lastStep?.txStatus !== "post-check" ||
      !isTroveId(lastStep.txReceiptData)
    ) {
      return;
    }

    const prefixedTroveId = getPrefixedTroveId(
      request.collIndex,
      lastStep.txReceiptData
    );

    while (true) {
      const { trove } = await graphQuery(TroveByIdQuery, {
        id: prefixedTroveId,
      });
      if (trove !== null) return;
    }
  },
};
