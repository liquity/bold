import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import {
  getBranch,
  getCollToken,
  getTroveOperationHints,
  useInterestBatchDelegate,
  usePredictOpenTroveUpfrontFee,
} from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { getIndexedTroveById } from "@/src/subgraph";
import { sleep } from "@/src/utils";
import { vAddress, vBranchId, vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256, parseEventLogs } from "viem";
import { readContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "openBorrowPosition",
  {
    branchId: vBranchId(),
    owner: vAddress(),
    ownerIndex: v.number(),
    collAmount: vDnum(),
    boldAmount: vDnum(),
    annualInterestRate: vDnum(),
    maxUpfrontFee: vDnum(),
    interestRateDelegate: v.union([v.null(), vAddress()]),
  },
);

export type OpenBorrowPositionRequest = v.InferOutput<typeof RequestSchema>;

export const openBorrowPosition: FlowDeclaration<OpenBorrowPositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const upfrontFee = usePredictOpenTroveUpfrontFee(
      request.branchId,
      request.boldAmount,
      request.interestRateDelegate ?? request.annualInterestRate,
    );

    const boldAmountWithFee = upfrontFee.data && dn.add(
      request.boldAmount,
      upfrontFee.data,
    );

    return (
      <LoanCard
        leverageMode={false}
        loadingState="success"
        loan={{
          type: "borrow",
          status: "active",
          troveId: null,
          borrower: request.owner,
          batchManager: request.interestRateDelegate,
          borrowed: boldAmountWithFee ?? dnum18(0),
          branchId: request.branchId,
          deposit: request.collAmount,
          interestRate: request.annualInterestRate,
        }}
        onRetry={() => {}}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const collateral = getCollToken(request.branchId);
    const collPrice = usePrice(collateral.symbol);

    const upfrontFee = usePredictOpenTroveUpfrontFee(
      request.branchId,
      request.boldAmount,
      request.interestRateDelegate ?? request.annualInterestRate,
    );

    const boldAmountWithFee = upfrontFee.data && dn.add(
      request.boldAmount,
      upfrontFee.data,
    );

    const { branchId, interestRateDelegate, boldAmount } = request;
    const delegate = useInterestBatchDelegate(branchId, interestRateDelegate);
    const yearlyBoldInterest = dn.mul(
      boldAmount,
      dn.add(request.annualInterestRate, delegate.data?.fee ?? 0),
    );

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
              key="end"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
              })}
            >
              <Amount
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
        {request.interestRateDelegate
          ? (
            <TransactionDetailsRow
              label="Interest rate delegate"
              value={[
                <AccountButton
                  key="start"
                  address={request.interestRateDelegate}
                />,
                <div key="end">
                  {delegate.isLoading
                    ? "Loading…"
                    : (
                      <>
                        <Amount
                          value={request.annualInterestRate}
                          format="pct2z"
                          percentage
                        />{" "}
                        <Amount
                          percentage
                          format="pct2"
                          prefix="+ "
                          suffix="% delegate fee"
                          fallback="…"
                          value={delegate.data?.fee}
                        />
                        <br />
                        <Amount
                          format="2z"
                          prefix="~"
                          suffix=" BOLD per year"
                          value={yearlyBoldInterest}
                        />
                      </>
                    )}
                </div>,
              ]}
            />
          )
          : (
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
                  value={boldAmountWithFee && dn.mul(
                    boldAmountWithFee,
                    request.annualInterestRate,
                  )}
                  suffix=" BOLD per year"
                />,
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
      name: (ctx) => {
        const branch = getBranch(ctx.request.branchId);
        return `Approve ${branch.symbol}`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        const branch = getBranch(ctx.request.branchId);
        const { LeverageLSTZapper, CollToken } = branch.contracts;

        return ctx.writeContract({
          ...CollToken,
          functionName: "approve",
          args: [
            LeverageLSTZapper.address,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : ctx.request.collAmount[0], // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    // LeverageLSTZapper mode
    openTroveLst: {
      name: () => "Open Position",
      Status: TransactionStatus,

      async commit(ctx) {
        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: ctx.request.branchId,
          interestRate: ctx.request.annualInterestRate[0],
        });

        const branch = getBranch(ctx.request.branchId);
        return ctx.writeContract({
          ...branch.contracts.LeverageLSTZapper,
          functionName: "openTroveWithRawETH" as const,
          args: [{
            owner: ctx.request.owner,
            ownerIndex: BigInt(ctx.request.ownerIndex),
            collAmount: ctx.request.collAmount[0],
            boldAmount: ctx.request.boldAmount[0],
            upperHint,
            lowerHint,
            annualInterestRate: ctx.request.interestRateDelegate
              ? 0n
              : ctx.request.annualInterestRate[0],
            batchManager: ctx.request.interestRateDelegate
              ? ctx.request.interestRateDelegate
              : ADDRESS_ZERO,
            maxUpfrontFee: ctx.request.maxUpfrontFee[0],
            addManager: ADDRESS_ZERO,
            removeManager: ADDRESS_ZERO,
            receiver: ADDRESS_ZERO,
          }],
          value: ETH_GAS_COMPENSATION[0],
        });
      },

      async verify(ctx, hash) {
        const receipt = await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);

        // extract trove ID from logs
        const branch = getBranch(ctx.request.branchId);
        const [troveOperation] = parseEventLogs({
          abi: branch.contracts.TroveManager.abi,
          logs: receipt.logs,
          eventName: "TroveOperation",
        });

        if (!troveOperation?.args?._troveId) {
          throw new Error("Failed to extract trove ID from transaction");
        }

        // wait for the trove to appear in the subgraph
        while (true) {
          const trove = await getIndexedTroveById(
            branch.branchId,
            `0x${troveOperation.args._troveId.toString(16)}`,
          );
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

      async commit(ctx) {
        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: ctx.request.branchId,
          interestRate: ctx.request.annualInterestRate[0],
        });

        const branch = getBranch(ctx.request.branchId);
        return ctx.writeContract({
          ...branch.contracts.LeverageWETHZapper,
          functionName: "openTroveWithRawETH",
          args: [{
            owner: ctx.request.owner,
            ownerIndex: BigInt(ctx.request.ownerIndex),
            collAmount: 0n,
            boldAmount: ctx.request.boldAmount[0],
            upperHint,
            lowerHint,
            annualInterestRate: ctx.request.interestRateDelegate
              ? 0n
              : ctx.request.annualInterestRate[0],
            batchManager: ctx.request.interestRateDelegate
              ? ctx.request.interestRateDelegate
              : ADDRESS_ZERO,
            maxUpfrontFee: ctx.request.maxUpfrontFee[0],
            addManager: ADDRESS_ZERO,
            removeManager: ADDRESS_ZERO,
            receiver: ADDRESS_ZERO,
          }],
          value: ctx.request.collAmount[0] + ETH_GAS_COMPENSATION[0],
        });
      },

      async verify(...args) {
        // same verification as openTroveLst
        return openBorrowPosition.steps.openTroveLst?.verify(...args);
      },
    },
  },

  async getSteps(ctx) {
    const branch = getBranch(ctx.request.branchId);

    // ETH doesn't need approval
    if (branch.symbol === "ETH") {
      return ["openTroveEth"];
    }

    // Check if approval is needed
    const allowance = await readContract(ctx.wagmiConfig, {
      ...branch.contracts.CollToken,
      functionName: "allowance",
      args: [ctx.account, branch.contracts.LeverageLSTZapper.address],
    });

    const steps: string[] = [];

    if (allowance < ctx.request.collAmount[0]) {
      steps.push("approveLst");
    }

    steps.push("openTroveLst");
    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
