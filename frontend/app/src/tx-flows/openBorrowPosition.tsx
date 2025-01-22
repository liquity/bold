import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import {
  getCollToken,
  getPrefixedTroveId,
  getTroveOperationHints,
  usePredictOpenTroveUpfrontFee,
} from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { sleep } from "@/src/utils";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, InfoTooltip, shortenAddress } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256, parseEventLogs } from "viem";
import { readContract, writeContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "openBorrowPosition",
  {
    collIndex: vCollIndex(),
    owner: vAddress(),
    ownerIndex: v.number(),
    collAmount: vDnum(),
    boldAmount: vDnum(),
    annualInterestRate: vDnum(),
    maxUpfrontFee: vDnum(),
    interestRateDelegate: v.union([
      v.null(),
      v.tuple([
        vAddress(),
        vDnum(),
        vDnum(),
      ]),
    ]),
  },
);

export type OpenBorrowPositionRequest = v.InferOutput<typeof RequestSchema>;

export const openBorrowPosition: FlowDeclaration<OpenBorrowPositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const upfrontFee = usePredictOpenTroveUpfrontFee(
      request.collIndex,
      request.boldAmount,
      request.interestRateDelegate?.[0] ?? request.annualInterestRate,
    );
    const boldAmountWithFee = upfrontFee.data && dn.add(request.boldAmount, upfrontFee.data);

    return (
      <LoanCard
        leverageMode={false}
        loadingState="success"
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

  Details({ request }) {
    const collateral = getCollToken(request.collIndex);
    if (!collateral) {
      throw new Error(`Invalid collateral index: ${request.collIndex}`);
    }

    const collPrice = usePrice(collateral.symbol);

    const upfrontFee = usePredictOpenTroveUpfrontFee(
      request.collIndex,
      request.boldAmount,
      request.interestRateDelegate?.[0] ?? request.annualInterestRate,
    );

    const boldAmountWithFee = upfrontFee.data && dn.add(request.boldAmount, upfrontFee.data);

    return collateral && (
      <>
        <TransactionDetailsRow
          label="Collateral"
          value={[
            `${fmtnum(request.collAmount)} ${collateral.name}`,
            <Amount
              key="end"
              fallback="…"
              prefix="$"
              value={collPrice.data && dn.mul(request.collAmount, collPrice.data)}
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Loan"
          value={[
            <Amount
              key="start"
              fallback="…"
              value={boldAmountWithFee}
              suffix=" BOLD"
            />,
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
              })}
            >
              <Amount
                key="end"
                fallback="…"
                prefix="Incl. "
                value={upfrontFee.data}
                suffix=" BOLD creation fee"
              />
              <InfoTooltip heading="BOLD Creation Fee">
                This fee is charged when you open a new loan or increase your debt. It corresponds to 7 days of average
                interest for the respective collateral asset.
              </InfoTooltip>
            </div>,
          ]}
        />
        <TransactionDetailsRow
          label="Interest rate"
          value={[
            <Amount
              key="start"
              value={request.annualInterestRate}
              percentage
            />,
            <Amount
              key="end"
              fallback="…"
              value={boldAmountWithFee && dn.mul(boldAmountWithFee, request.annualInterestRate)}
              suffix=" BOLD per year"
            />,
          ]}
        />
        {request.interestRateDelegate && (
          <TransactionDetailsRow
            label="Interest rate delegate"
            value={[
              <span
                key="start"
                title={request.interestRateDelegate[0]}
              >
                {shortenAddress(request.interestRateDelegate[0], 4)}
              </span>,
            ]}
          />
        )}
        <TransactionDetailsRow
          label="Refundable gas deposit"
          value={[
            <div
              key="start"
              title={`${fmtnum(ETH_GAS_COMPENSATION, "full")} ETH`}
            >
              {fmtnum(ETH_GAS_COMPENSATION, 4)} ETH
            </div>,
            "Only used in case of liquidation",
          ]}
        />
      </>
    );
  },

  steps: {
    // Approve LST
    approveLst: {
      name: ({ contracts, request }) => {
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.collIndex}`);
        }
        return `Approve ${collateral.symbol}`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit({
        contracts,
        request,
        wagmiConfig,
        preferredApproveMethod,
      }) {
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.collIndex}`);
        }
        const { LeverageLSTZapper, CollToken } = collateral.contracts;

        return writeContract(wagmiConfig, {
          ...CollToken,
          functionName: "approve",
          args: [
            LeverageLSTZapper.address,
            preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : request.collAmount[0], // exact amount
          ],
        });
      },
      async verify({ wagmiConfig, isSafe }, hash) {
        await verifyTransaction(wagmiConfig, hash, isSafe);
      },
    },

    // LeverageLSTZapper mode
    openTroveLst: {
      name: () => "Open Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.collIndex}`);
        }

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig,
          contracts,
          collIndex: request.collIndex,
          interestRate: request.annualInterestRate[0],
        });

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageLSTZapper,
          functionName: "openTroveWithRawETH" as const,
          args: [{
            owner: request.owner,
            ownerIndex: BigInt(request.ownerIndex),
            collAmount: request.collAmount[0],
            boldAmount: request.boldAmount[0],
            upperHint,
            lowerHint,
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
          }],
          value: ETH_GAS_COMPENSATION[0],
        });
      },

      async verify({ contracts, request, wagmiConfig, isSafe }, hash) {
        const receipt = await verifyTransaction(wagmiConfig, hash, isSafe);

        // extract trove ID from logs
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.collIndex}`);
        }
        const [troveOperation] = parseEventLogs({
          abi: collateral.contracts.TroveManager.abi,
          logs: receipt.logs,
          eventName: "TroveOperation",
        });

        if (!troveOperation?.args?._troveId) {
          throw new Error("Failed to extract trove ID from transaction");
        }

        const prefixedTroveId = getPrefixedTroveId(
          request.collIndex,
          `0x${troveOperation.args._troveId.toString(16)}`,
        );

        // wait for the trove to appear in the subgraph
        while (true) {
          const { trove } = await graphQuery(TroveByIdQuery, {
            id: prefixedTroveId,
          });
          if (trove !== null) {
            break;
          }
          await sleep(1000);
        }
      },
    },

    // LeverageWETHZapper mode
    openTroveEth: {
      name: () => "Open Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const collateral = contracts.collaterals[request.collIndex];
        if (!collateral) {
          throw new Error(`Invalid collateral index: ${request.collIndex}`);
        }

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig,
          contracts,
          collIndex: request.collIndex,
          interestRate: request.annualInterestRate[0],
        });

        return writeContract(wagmiConfig, {
          ...collateral.contracts.LeverageWETHZapper,
          functionName: "openTroveWithRawETH",
          args: [{
            owner: request.owner,
            ownerIndex: BigInt(request.ownerIndex),
            collAmount: 0n,
            boldAmount: request.boldAmount[0],
            upperHint,
            lowerHint,
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
          }],
          value: request.collAmount[0] + ETH_GAS_COMPENSATION[0],
        });
      },

      async verify(...args) {
        // same verification as openTroveLst
        return openBorrowPosition.steps.openTroveLst?.verify(...args);
      },
    },
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    if (!account) {
      throw new Error("Account address is required");
    }

    const collateral = contracts.collaterals[request.collIndex];
    if (!collateral) {
      throw new Error(`Invalid collateral index: ${request.collIndex}`);
    }
    const { LeverageLSTZapper, CollToken } = collateral.contracts;

    // ETH collateral doesn't need approval
    if (collateral.symbol === "ETH") {
      return ["openTroveEth"];
    }

    // Check if approval is needed
    const allowance = await readContract(wagmiConfig, {
      ...CollToken,
      functionName: "allowance",
      args: [account, LeverageLSTZapper.address],
    });

    const steps: string[] = [];

    if (allowance < request.collAmount[0]) {
      steps.push("approveLst");
    }

    steps.push("openTroveLst");
    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
