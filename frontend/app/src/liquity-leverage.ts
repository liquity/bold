import type { FlowStep } from "@/src/services/TransactionFlow";
import type { BranchId, CollateralSymbol, Dnum } from "@/src/types";

import { getBranchContract, getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { getBranch } from "@/src/liquity-utils";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useMemo } from "react";
import { parseEventLogs } from "viem";
import { useConfig as useWagmiConfig, useReadContracts } from "wagmi";
import { getTransactionReceipt } from "wagmi/actions";
import { useDebounced } from "./react-utils";

const MARGINAL_AMOUNT_DIVIDER = 1_000n;

export type SwapDirection =
  | { inputToken: "BOLD"; outputToken: CollateralSymbol }
  | { inputToken: CollateralSymbol; outputToken: "BOLD" };

export type QuoteExactInputParams = SwapDirection & {
  inputAmount: Dnum;
};

export type QuoteExactOutputParams = SwapDirection & {
  outputAmount: Dnum;
};

function calcPriceImpact(
  inputAmount: bigint,
  inputAmountMarginal: bigint,
  outputAmount: bigint,
  outputAmountMarginal: bigint,
) {
  if (inputAmount == 0n || inputAmountMarginal == 0n) return null;

  const exchangeRate = dn.div(outputAmount, inputAmount, 18);
  const exchangeRateMarginal = dn.div(outputAmountMarginal, inputAmountMarginal, 18);

  if (dn.eq(exchangeRateMarginal, DNUM_0)) return null;
  return dn.div(dn.sub(exchangeRateMarginal, exchangeRate), exchangeRateMarginal);
}

export function useQuoteExactInput(params: QuoteExactInputParams) {
  const inputAmount = dn.from(params.inputAmount, 18)[0];
  const inputAmountMarginal = inputAmount / MARGINAL_AMOUNT_DIVIDER;
  const collToBold = params.outputToken === "BOLD";
  const collToken = getBranchContract(collToBold ? params.inputToken : params.outputToken, "CollToken").address;

  const values = useMemo(() => ({
    inputAmount,
    inputAmountMarginal,
    collToBold,
    collToken,
  }), [inputAmount, inputAmountMarginal, collToBold, collToken]);

  const [debounced, bouncing] = useDebounced(values);
  const ExchangeHelpersV2 = getProtocolContract("ExchangeHelpersV2");

  return useReadContracts({
    contracts: [
      {
        ...ExchangeHelpersV2,
        functionName: "quoteExactInput",
        args: [debounced.inputAmount, debounced.collToBold, debounced.collToken],
      },
      {
        ...ExchangeHelpersV2,
        functionName: "quoteExactInput",
        args: [debounced.inputAmountMarginal, debounced.collToBold, debounced.collToken],
      },
    ],

    query: {
      refetchInterval: 12_000,
      enabled: !bouncing && debounced.inputAmountMarginal > 0n, // implies debounced.inputAmount > 0n

      select: (data) =>
        data[0].status === "failure"
          ? ({ bouncing, outputAmount: null, priceImpact: null })
          : ({
            bouncing,
            outputAmount: dnum18(data[0].result),
            priceImpact: calcPriceImpact(
              debounced.inputAmount,
              debounced.inputAmountMarginal,
              data[0].result,
              data[1].result ?? 0n,
            ),
          }),
    },
  });
}

export function useQuoteExactOutput(params: QuoteExactOutputParams) {
  const outputAmount = dn.from(params.outputAmount, 18)[0];
  const outputAmountMarginal = outputAmount / MARGINAL_AMOUNT_DIVIDER;
  const collToBold = params.outputToken === "BOLD";
  const collToken = getBranchContract(collToBold ? params.inputToken : params.outputToken, "CollToken").address;

  const values = useMemo(() => ({
    outputAmount,
    outputAmountMarginal,
    collToBold,
    collToken,
  }), [outputAmount, outputAmountMarginal, collToBold, collToken]);

  const [debounced, bouncing] = useDebounced(values);
  const ExchangeHelpersV2 = getProtocolContract("ExchangeHelpersV2");

  return useReadContracts({
    contracts: [
      {
        ...ExchangeHelpersV2,
        functionName: "quoteExactOutput",
        args: [debounced.outputAmount, debounced.collToBold, debounced.collToken],
      },
      {
        ...ExchangeHelpersV2,
        functionName: "quoteExactOutput",
        args: [debounced.outputAmountMarginal, debounced.collToBold, debounced.collToken],
      },
    ],

    query: {
      refetchInterval: 12_000,
      enabled: !bouncing && debounced.outputAmountMarginal > 0n, // implies debounced.outputAmount > 0n

      select: (data) =>
        data[0].status === "failure"
          ? ({ bouncing, inputAmount: null, priceImpact: null })
          : ({
            bouncing,
            inputAmount: dnum18(data[0].result),
            priceImpact: calcPriceImpact(
              data[0].result,
              data[1].result ?? 0n,
              debounced.outputAmount,
              debounced.outputAmountMarginal,
            ),
          }),
    },
  });
}

/**
 * Extracts the slippage refund amount from a leverage or close position transaction receipt.
 * The slippage refund is a Transfer event from the zapper contract to the user's wallet.
 *
 * Supported transaction types:
 * - openLeveragedTrove: Opening a leverage position
 * - leverUpTrove: Increasing leverage
 * - leverDownTrove: Decreasing leverage
 * - closeLoanPosition: Closing position (when repaying with collateral)
 */
export function useSlippageRefund(
  branchId: BranchId,
  account: string,
  steps: FlowStep[] | null,
  isCloseLoanToCollateral = false,
) {
  const wagmiConfig = useWagmiConfig();
  const branch = getBranch(branchId);

  // Find the last confirmed step that might have a slippage refund
  const relevantStep = steps
    ?.slice()
    .reverse()
    .find(
      (step) =>
        (
          step.id === "leverUpTrove"
          || step.id === "leverDownTrove"
          || (step.id === "closeLoanPosition" && isCloseLoanToCollateral)
          || step.id === "openLeveragedTrove"
        )
        && step.status === "confirmed"
        && step.artifact,
    );

  return useQuery({
    enabled: Boolean(relevantStep?.artifact),
    queryKey: ["slippage-refund", relevantStep?.artifact],
    queryFn: async () => {
      if (!relevantStep?.artifact) return null;

      const receipt = await getTransactionReceipt(wagmiConfig, {
        hash: relevantStep.artifact as `0x${string}`,
      });

      const transferEvents = parseEventLogs({
        abi: branch.contracts.CollToken.abi,
        logs: receipt.logs,
        eventName: "Transfer",
      });

      // Find transfer from zapper to user (slippage refund)
      const zapperAddress = branch.symbol === "ETH"
        ? branch.contracts.LeverageWETHZapper.address.toLowerCase()
        : branch.contracts.LeverageLSTZapper.address.toLowerCase();

      const slippageTransfer = transferEvents.find(
        (event) =>
          event.args.from?.toLowerCase() === zapperAddress
          && event.args.to?.toLowerCase() === account.toLowerCase(),
      );

      return slippageTransfer?.args.value
        ? dnum18(slippageTransfer.args.value)
        : null;
    },
  });
}
