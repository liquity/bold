import type { RedeemableTrove } from "@/src/liquity-utils";
import type { Dnum } from "@/src/types";

import { dnum18, DNUM_0, DNUM_1 } from "@/src/dnum-utils";
import * as dn from "dnum";

export const URGENT_REDEMPTION_BONUS = dnum18(2n * 10n ** 16n); // 2%
export const URGENT_REDEMPTION_BONUS_MULTIPLIER = dn.add(DNUM_1, URGENT_REDEMPTION_BONUS); // 1.02
export const URGENT_REDEMPTION_BONUS_PCT = `${dn.toNumber(dn.multiply(URGENT_REDEMPTION_BONUS, 100))}%`;
export const DEFAULT_SLIPPAGE = dnum18(10n ** 16n); // 1%
export const TROVES_PER_PAGE = 20;

export type TroveWithICR = RedeemableTrove & {
  icr: Dnum;
};

export function calculateICR(coll: Dnum, debt: Dnum, price: Dnum): Dnum {
  return dn.div(dn.mul(coll, price), debt);
}

export function addICRToTroves(
  troves: RedeemableTrove[],
  price: Dnum,
): TroveWithICR[] {
  return troves.map((trove) => ({
    ...trove,
    icr: calculateICR(trove.coll, trove.debt, price),
  }));
}

export type TroveSelectionResult = {
  selectedTroves: TroveWithICR[];
  totalDebt: Dnum;
  totalColl: Dnum;
  actualBoldToRedeem: Dnum;
  isAmountCapped: boolean;
};

export function sortByRedeemableValue<T extends { coll: Dnum; debt: Dnum }>(
  troves: T[],
  price: Dnum,
): T[] {
  return [...troves].sort((a, b) => {
    return dn.cmp(
      effectiveRedeemable(b, price),
      effectiveRedeemable(a, price),
    );
  });
}

export function effectiveRedeemable(trove: { coll: Dnum; debt: Dnum }, price: Dnum): Dnum {
  const collBold = dn.div(dn.mul(trove.coll, price), URGENT_REDEMPTION_BONUS_MULTIPLIER);
  return dn.lt(trove.debt, collBold) ? trove.debt : collBold;
}

export function selectOptimalTroves(
  troves: TroveWithICR[],
  boldAmount: Dnum,
  price: Dnum,
): TroveSelectionResult {
  const validTroves = troves.filter((trove) => dn.gt(trove.debt, DNUM_0));

  const sortedTroves = sortByRedeemableValue(validTroves, price);

  const selectedTroves: TroveWithICR[] = [];
  let totalDebt = DNUM_0;
  let totalColl = DNUM_0;
  let totalRedeemable = DNUM_0;

  for (const trove of sortedTroves) {
    if (dn.gte(totalRedeemable, boldAmount)) {
      break;
    }
    selectedTroves.push(trove);
    totalDebt = dn.add(totalDebt, trove.debt);
    totalColl = dn.add(totalColl, trove.coll);
    totalRedeemable = dn.add(totalRedeemable, effectiveRedeemable(trove, price));
  }

  const actualBoldToRedeem = dn.lt(totalRedeemable, boldAmount) ? totalRedeemable : boldAmount;
  const isAmountCapped = dn.lt(totalRedeemable, boldAmount);

  return {
    selectedTroves,
    totalDebt,
    totalColl,
    actualBoldToRedeem,
    isAmountCapped,
  };
}

export type RedemptionOutput = {
  collateral: Dnum;
  collateralWithoutBonus: Dnum;
  bonus: Dnum;
  collateralUsd: Dnum;
  bonusUsd: Dnum;
};

export function calculateRedemptionOutput(
  selectedTroves: TroveWithICR[],
  boldAmount: Dnum,
  price: Dnum,
): RedemptionOutput {
  if (dn.eq(price, DNUM_0) || selectedTroves.length === 0) {
    return {
      collateral: DNUM_0,
      collateralWithoutBonus: DNUM_0,
      bonus: DNUM_0,
      collateralUsd: DNUM_0,
      bonusUsd: DNUM_0,
    };
  }

  let totalCollateral = DNUM_0;
  let remainingBold = boldAmount;

  for (const trove of selectedTroves) {
    if (dn.lte(remainingBold, DNUM_0)) break;

    const boldFromTrove = dn.lt(trove.debt, remainingBold)
      ? trove.debt
      : remainingBold;

    const collFromTrove = dn.div(dn.mul(boldFromTrove, URGENT_REDEMPTION_BONUS_MULTIPLIER), price);

    if (dn.lt(collFromTrove, trove.coll)) {
      totalCollateral = dn.add(totalCollateral, collFromTrove);
      remainingBold = dn.sub(remainingBold, boldFromTrove);
    } else {
      totalCollateral = dn.add(totalCollateral, trove.coll);
      remainingBold = dn.sub(remainingBold, dn.div(dn.mul(trove.coll, price), URGENT_REDEMPTION_BONUS_MULTIPLIER));
    }
  }

  const collateralWithoutBonus = dn.div(dn.sub(boldAmount, remainingBold), price);
  const bonus = dn.sub(totalCollateral, collateralWithoutBonus);

  const collateralUsd = dn.mul(totalCollateral, price);
  const bonusUsd = dn.mul(bonus, price);

  return {
    collateral: totalCollateral,
    collateralWithoutBonus,
    bonus,
    collateralUsd,
    bonusUsd,
  };
}

export function calculateMinCollateral(
  expectedColl: Dnum,
  slippagePct: Dnum,
): Dnum {
  const slippageMultiplier = dn.sub(DNUM_1, slippagePct);
  return dn.mul(expectedColl, slippageMultiplier);
}
