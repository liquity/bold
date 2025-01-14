import type { CollIndex, Dnum, TroveId } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { CLOSE_FROM_COLLATERAL_SLIPPAGE, DATA_REFRESH_INTERVAL } from "@/src/constants";
import { getProtocolContract } from "@/src/contracts";
import { getCollateralContracts } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { useDebouncedQueryKey } from "@/src/react-utils";
import { useWagmiConfig } from "@/src/services/Ethereum";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { readContract, readContracts } from "wagmi/actions";

const DECIMAL_PRECISION = 10n ** 18n;

export async function getLeverUpTroveParams(
  collIndex: CollIndex,
  troveId: TroveId,
  leverageFactor: number,
  wagmiConfig: WagmiConfig,
) {
  const collContracts = getCollateralContracts(collIndex);

  if (!collContracts) {
    throw new Error("Invalid collateral index: " + collIndex);
  }

  const { PriceFeed, TroveManager } = collContracts;

  const [priceResult, troveDataResult] = await readContracts(wagmiConfig, {
    contracts: [{
      abi: PriceFeed.abi,
      address: PriceFeed.address,
      functionName: "fetchPrice",
    }, {
      abi: TroveManager.abi,
      address: TroveManager.address,
      functionName: "getLatestTroveData",
      args: [BigInt(troveId)],
    }],
  });

  const [price] = priceResult.result ?? [];
  const troveData = troveDataResult.result;

  if (!price || !troveData) {
    return null;
  }

  const currentCR = await readContract(wagmiConfig, {
    abi: TroveManager.abi,
    address: TroveManager.address,
    functionName: "getCurrentICR",
    args: [BigInt(troveId), price],
  });

  const currentLR = leverageRatioToCollateralRatio(currentCR);

  const leverageRatio = BigInt(leverageFactor * 1000) * DECIMAL_PRECISION / 1000n;
  if (leverageRatio <= currentLR) {
    throw new Error(`Multiply ratio should increase: ${leverageRatio} <= ${currentLR}`);
  }

  const currentCollAmount = troveData.entireColl;
  const flashLoanAmount = currentCollAmount * leverageRatio / currentLR - currentCollAmount;
  const expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
  const maxNetDebtIncrease = expectedBoldAmount * 105n / 100n; // 5% slippage

  return {
    flashLoanAmount,
    effectiveBoldAmount: maxNetDebtIncrease,
  };
}

export async function getLeverDownTroveParams(
  collIndex: CollIndex,
  troveId: TroveId,
  leverageFactor: number,
  wagmiConfig: WagmiConfig,
) {
  const collContracts = getCollateralContracts(collIndex);

  if (!collContracts) {
    throw new Error("Invalid collateral index: " + collIndex);
  }

  const { PriceFeed, TroveManager } = collContracts;

  const [priceResult, troveDataResult] = await readContracts(wagmiConfig, {
    contracts: [{
      abi: PriceFeed.abi,
      address: PriceFeed.address,
      functionName: "fetchPrice",
    }, {
      abi: TroveManager.abi,
      address: TroveManager.address,
      functionName: "getLatestTroveData",
      args: [BigInt(troveId)],
    }],
  });

  const [price] = priceResult.result ?? [];
  const troveData = troveDataResult.result;

  if (!price || !troveData) {
    return null;
  }

  const currentCR = await readContract(wagmiConfig, {
    abi: TroveManager.abi,
    address: TroveManager.address,
    functionName: "getCurrentICR",
    args: [BigInt(troveId), price],
  });

  const currentLR = leverageRatioToCollateralRatio(currentCR);

  const leverageRatio = BigInt(leverageFactor * 1000) * DECIMAL_PRECISION / 1000n;
  if (leverageRatio >= currentLR) {
    throw new Error(`Multiply ratio should decrease: ${leverageRatio} >= ${currentLR}`);
  }

  const currentCollAmount = troveData.entireColl;
  const flashLoanAmount = currentCollAmount - (currentCollAmount * leverageRatio / currentLR);
  const expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
  const minBoldDebt = expectedBoldAmount * 95n / 100n; // 5% slippage

  return {
    flashLoanAmount,
    minBoldAmount: minBoldDebt,
  };
}

// from openLeveragedTroveWithIndex() in contracts/src/test/zapperLeverage.t.sol
export async function getOpenLeveragedTroveParams(
  collIndex: CollIndex,
  collAmount: bigint,
  leverageFactor: number,
  wagmiConfig: WagmiConfig,
) {
  const collContracts = getCollateralContracts(collIndex);

  if (!collContracts) {
    throw new Error("Invalid collateral index: " + collIndex);
  }

  const { PriceFeed } = collContracts;

  const [price] = await readContract(wagmiConfig, {
    abi: PriceFeed.abi,
    address: PriceFeed.address,
    functionName: "fetchPrice",
  });

  const leverageRatio = BigInt(leverageFactor * 1000) * DECIMAL_PRECISION / 1000n;
  const flashLoanAmount = collAmount * (leverageRatio - DECIMAL_PRECISION) / DECIMAL_PRECISION;
  const expectedBoldAmount = flashLoanAmount * price / DECIMAL_PRECISION;
  const maxNetDebt = expectedBoldAmount * 105n / 100n; // 5% slippage

  return {
    effectiveBoldAmount: maxNetDebt,
    expectedBoldAmount,
    flashLoanAmount,
    maxNetDebt,
    price,
  };
}

// from _getCloseFlashLoanAmount() in contracts/src/test/zapperLeverage.t.sol
export async function getCloseFlashLoanAmount(
  collIndex: CollIndex,
  troveId: TroveId,
  wagmiConfig: WagmiConfig,
): Promise<bigint | null> {
  const collContracts = getCollateralContracts(collIndex);

  if (!collContracts) {
    throw new Error("Invalid collateral index: " + collIndex);
  }

  const { PriceFeed, TroveManager } = collContracts;

  const [priceResult, latestTroveDataResult] = await readContracts(wagmiConfig, {
    contracts: [
      {
        abi: PriceFeed.abi,
        address: PriceFeed.address,
        functionName: "fetchPrice",
      },
      {
        abi: TroveManager.abi,
        address: TroveManager.address,
        functionName: "getLatestTroveData",
        args: [BigInt(troveId)],
      },
    ],
  });

  const [price] = priceResult.result ?? [];
  const latestTroveData = latestTroveDataResult.result;

  if (!price || !latestTroveData) {
    return null;
  }

  return (
    latestTroveData.entireDebt * DECIMAL_PRECISION
    / price
    * BigInt(100 + CLOSE_FROM_COLLATERAL_SLIPPAGE * 100)
    / 100n
  );
}

function leverageRatioToCollateralRatio(inputRatio: bigint) {
  return inputRatio * DECIMAL_PRECISION / (inputRatio - DECIMAL_PRECISION);
}

export function useCheckLeverageSlippage({
  collIndex,
  initialDeposit,
  leverageFactor,
  ownerIndex,
}: {
  collIndex: CollIndex;
  initialDeposit: Dnum | null;
  leverageFactor: number;
  ownerIndex: number | null;
}) {
  const wagmiConfig = useWagmiConfig();
  const WethContract = getProtocolContract("WETH");
  const ExchangeHelpersContract = getProtocolContract("ExchangeHelpers");

  const debouncedQueryKey = useDebouncedQueryKey([
    "openLeveragedTroveParams",
    collIndex,
    String(!initialDeposit || initialDeposit[0]),
    leverageFactor,
    ownerIndex,
  ], 100);

  return useQuery({
    queryKey: debouncedQueryKey,
    queryFn: async () => {
      const params = initialDeposit && await getOpenLeveragedTroveParams(
        collIndex,
        initialDeposit[0],
        leverageFactor,
        wagmiConfig,
      );

      if (params === null) {
        return null;
      }

      const [_, slippage] = await readContract(wagmiConfig, {
        abi: ExchangeHelpersContract.abi,
        address: ExchangeHelpersContract.address,
        functionName: "getCollFromBold",
        args: [
          params.expectedBoldAmount,
          WethContract.address,
          params.flashLoanAmount,
        ],
      });

      return dnum18(slippage);
    },
    enabled: Boolean(
      initialDeposit
        && dn.gt(initialDeposit, 0)
        && ownerIndex !== null,
    ),
    refetchInterval: DATA_REFRESH_INTERVAL,
  });
}
