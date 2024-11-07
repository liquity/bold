import type { CollIndex, TroveId } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { CLOSE_FROM_COLLATERAL_SLIPPAGE } from "@/src/constants";
import { getCollateralContracts } from "@/src/contracts";
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
    throw new Error(`Leverage ratio should increase: ${leverageRatio} <= ${currentLR}`);
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
    throw new Error(`Leverage ratio should decrease: ${leverageRatio} >= ${currentLR}`);
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
