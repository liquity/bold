import type { LoanDetails, RiskLevel } from "@/src/types";
import type { Dnum } from "dnum";

import { LTV_RISK, MAX_LTV_ALLOWED_RATIO, REDEMPTION_RISK } from "@/src/constants";
import * as dn from "dnum";
import { match } from "ts-pattern";

export function getRedemptionRisk(
  debtInFront: Dnum | null,
  totalDebt: Dnum | null,
): null | RiskLevel {
  if (!debtInFront || !totalDebt || dn.eq(totalDebt, 0)) {
    return null;
  }

  const debtInFrontRatio = dn.div(debtInFront, totalDebt);

  return match(debtInFrontRatio)
    .returnType<RiskLevel>()
    .when((ratio) => dn.gt(ratio, REDEMPTION_RISK.low), () => "low")
    .when((ratio) => dn.gt(ratio, REDEMPTION_RISK.medium), () => "medium")
    .otherwise(() => "high");
}

export function getLiquidationRisk(ltv: Dnum, maxLtv: Dnum): RiskLevel {
  return match(ltv)
    .returnType<RiskLevel>()
    .when((ltv) => dn.gt(ltv, dn.mul(maxLtv, LTV_RISK.high)), () => "high")
    .when((ltv) => dn.gt(ltv, dn.mul(maxLtv, LTV_RISK.medium)), () => "medium")
    .otherwise(() => "low");
}

export function getLtvFromLeverageFactor(leverageFactor: number): Dnum | null {
  // invalid leverage factor
  if (leverageFactor <= 0) {
    return null;
  }
  return dn.div(
    dn.sub(leverageFactor, dn.from(1, 18)),
    leverageFactor,
  );
}

export function getLeverageFactorFromLtv(ltv: Dnum): number {
  // returns negative values for underwater positions (LTV > 100%)
  return 1 / (1 - dn.toNumber(ltv));
}

export function getLeverageFactorFromLiquidationPrice(
  liquidationPrice: Dnum,
  collPrice: Dnum,
  minCollRatio: number,
): null | number {
  const collPriceRatio = dn.mul(collPrice, minCollRatio);

  if (!dn.lt(liquidationPrice, collPriceRatio)) {
    return null;
  }

  return Math.round(
    dn.toNumber(dn.div(
      collPriceRatio,
      dn.sub(collPriceRatio, liquidationPrice),
    )) * 10,
  ) / 10;
}

export function getLiquidationPriceFromLeverage(
  leverage: number,
  collPrice: Dnum,
  minCollRatio: number,
): Dnum {
  return dn.div(
    dn.mul(
      dn.mul(
        dn.sub(leverage, 1, 18),
        minCollRatio,
      ),
      collPrice,
    ),
    leverage,
  );
}

export function getLiquidationPrice(
  deposit: Dnum,
  borrowed: Dnum,
  minCollRatio: number,
): Dnum | null {
  // deposit and borrow amounts must be positive
  if (!dn.gt(deposit, 0) || !dn.gt(borrowed, 0)) {
    return null;
  }
  if (minCollRatio <= 1) {
    return null;
  }
  return dn.div(
    dn.mul(borrowed, minCollRatio),
    deposit,
  );
}

export function getLtv(
  deposit: Dnum,
  debt: Dnum,
  collPrice: Dnum,
): Dnum | null {
  const depositUsd = dn.mul(deposit, collPrice);
  return dn.gt(depositUsd, 0) ? dn.div(debt, depositUsd) : null;
}

export function getLoanDetails(
  deposit: Dnum | null,
  debt: Dnum | null,
  interestRate: Dnum | null,
  minCollRatio: number,
  collPrice: Dnum | null,
): LoanDetails {
  const maxLtv = dn.div(dn.from(1, 18), minCollRatio);
  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED_RATIO);
  const depositUsd = deposit && collPrice ? dn.mul(deposit, collPrice) : null;

  const ltv = debt && depositUsd && !dn.eq(depositUsd, 0)
    ? dn.div(debt, depositUsd)
    : deposit && dn.lt(deposit, 0)
    ? dn.from(1, 18)
    : null;

  const status = match([ltv, deposit] as const)
    .returnType<LoanDetails["status"]>()
    .when(([ltv]) => !ltv, () => null)
    .when(([ltv, deposit]) =>
      ltv && deposit && (
        dn.lt(deposit, 0) || dn.gt(ltv, 1)
      ), () => "underwater")
    .when(([ltv]) => ltv && dn.gt(ltv, maxLtv), () => "liquidatable")
    .when(([ltv]) => ltv && dn.gt(ltv, maxLtvAllowed), () => "at-risk")
    .otherwise(() => "healthy");

  const maxDebt = depositUsd && dn.mul(depositUsd, maxLtv);

  const maxDebtAllowed = depositUsd && dn.gt(depositUsd, 0)
    ? dn.mul(depositUsd, maxLtvAllowed)
    : null;

  const liquidationRisk = ltv
    ? getLiquidationRisk(ltv, maxLtv)
    : null;

  const leverageFactor = ltv
    ? getLeverageFactorFromLtv(ltv)
    : null;

  const depositPreLeverage = deposit && leverageFactor && Number.isFinite(leverageFactor)
    ? dn.div(deposit, leverageFactor)
    : null;

  const depositToZero = debt && deposit && collPrice && dn.gt(collPrice, 0)
    ? dn.div(dn.sub(debt, dn.mul(deposit, collPrice)), collPrice)
    : null;

  const liquidationPrice = deposit && debt && dn.gt(deposit, 0)
    ? getLiquidationPrice(deposit, debt, minCollRatio)
    : null;

  return {
    collPrice,
    debt,
    deposit,
    depositPreLeverage,
    depositToZero,
    depositUsd,
    interestRate,
    leverageFactor,
    liquidationPrice,
    liquidationRisk,
    ltv,
    maxDebt,
    maxDebtAllowed,
    maxLtv,
    maxLtvAllowed,
    status,
  };
}
