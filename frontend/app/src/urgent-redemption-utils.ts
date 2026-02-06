import type { RedeemableTrove } from "@/src/liquity-utils";
import type { Dnum } from "@/src/types";

import { dnum18, DNUM_0, DNUM_1 } from "@/src/dnum-utils";
import * as dn from "dnum";

export const URGENT_REDEMPTION_BONUS = dnum18(2n * 10n ** 16n); // 2%
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
  const multiplier = dn.add(DNUM_1, URGENT_REDEMPTION_BONUS);
  return [...troves].sort((a, b) => {
    const aCollBold = dn.div(dn.mul(a.coll, price), multiplier);
    const aEffective = dn.lt(a.debt, aCollBold) ? a.debt : aCollBold;
    const bCollBold = dn.div(dn.mul(b.coll, price), multiplier);
    const bEffective = dn.lt(b.debt, bCollBold) ? b.debt : bCollBold;
    return dn.cmp(bEffective, aEffective);
  });
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

  for (const trove of sortedTroves) {
    if (dn.gte(totalDebt, boldAmount)) {
      break;
    }
    selectedTroves.push(trove);
    totalDebt = dn.add(totalDebt, trove.debt);
    totalColl = dn.add(totalColl, trove.coll);
  }

  const actualBoldToRedeem = dn.lt(totalDebt, boldAmount) ? totalDebt : boldAmount;
  const isAmountCapped = dn.lt(totalDebt, boldAmount);

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
  isBonusCapped: boolean;
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
      isBonusCapped: false,
    };
  }

  let totalCollateral = DNUM_0;
  let remainingBold = boldAmount;

  const multiplier = dn.add(DNUM_1, URGENT_REDEMPTION_BONUS);

  for (const trove of selectedTroves) {
    if (dn.lte(remainingBold, DNUM_0)) break;

    const boldFromTrove = dn.lt(trove.debt, remainingBold)
      ? trove.debt
      : remainingBold;

    const collFromTrove = dn.div(dn.mul(boldFromTrove, multiplier), price);

    const actualColl = dn.lt(collFromTrove, trove.coll)
      ? collFromTrove
      : trove.coll;

    totalCollateral = dn.add(totalCollateral, actualColl);
    remainingBold = dn.sub(remainingBold, boldFromTrove);
  }

  const collateralWithoutBonus = dn.div(dn.sub(boldAmount, remainingBold), price);
  const rawBonus = dn.sub(totalCollateral, collateralWithoutBonus);
  const isBonusCapped = dn.lt(rawBonus, dn.mul(collateralWithoutBonus, URGENT_REDEMPTION_BONUS));
  const bonus = dn.gt(rawBonus, DNUM_0) ? rawBonus : DNUM_0;

  const collateralUsd = dn.mul(totalCollateral, price);
  const bonusUsd = dn.mul(bonus, price);

  return {
    collateral: totalCollateral,
    collateralWithoutBonus,
    bonus,
    collateralUsd,
    bonusUsd,
    isBonusCapped,
  };
}

export function calculateMinCollateral(
  expectedColl: Dnum,
  slippagePct: Dnum,
): Dnum {
  const slippageMultiplier = dn.sub(DNUM_1, slippagePct);
  return dn.mul(expectedColl, slippageMultiplier);
}
