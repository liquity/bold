import type { RiskLevel } from "@/src/types";
import type { Dnum } from "dnum";

import { LTV_RISK, MAX_LTV_ALLOWED, REDEMPTION_RISK } from "@/src/constants";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

export function getRedemptionRisk(interest: Dnum | null): null | RiskLevel {
  return match(interest)
    .returnType<RiskLevel | null>()
    .with(P.nullish, () => null)
    .when((r) => dn.lt(r, 0) || dn.eq(r, 0), () => "high")
    .when((r) => dn.gt(r, REDEMPTION_RISK.low), () => "low")
    .when((r) => dn.gt(r, REDEMPTION_RISK.medium), () => "medium")
    .otherwise(() => "high");
}

export function getLiquidationRisk(ltv: Dnum, maxLtv: Dnum): RiskLevel {
  return match(ltv)
    .returnType<RiskLevel>()
    .when((ltv) => dn.gt(ltv, dn.mul(maxLtv, LTV_RISK.high)), () => "high")
    .when((ltv) => dn.gt(ltv, dn.mul(maxLtv, LTV_RISK.medium)), () => "medium")
    .otherwise(() => "low");
}

export function getLtvFromLeverageFactor(leverageFactor: number): Dnum {
  if (leverageFactor <= 0) {
    throw new Error("Invalid leverage factor");
  }
  return dn.div(
    dn.sub(leverageFactor, dn.from(1, 18)),
    leverageFactor,
  );
}

export function getLeverageFactorFromLtv(ltv: Dnum): number {
  return Math.round(1 / (1 - dn.toNumber(ltv)) * 10) / 10;
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
): Dnum {
  if (!dn.gt(deposit, 0) || !dn.gt(borrowed, 0)) {
    throw new Error("Deposit and borrow amounts must be positive");
  }
  if (minCollRatio <= 1) {
    throw new Error("Minimum collateral ratio must be greater than 1");
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

export type LoanDetails = {
  collPrice: Dnum | null;
  debt: Dnum | null;
  deposit: Dnum | null;
  depositPreLeverage: Dnum | null;
  depositUsd: Dnum | null;
  interestRate: Dnum | null;
  leverageFactor: number | null;
  liquidationPrice: Dnum | null;
  liquidationRisk: RiskLevel | null;
  ltv: Dnum | null;
  maxDebt: Dnum | null;
  maxDebtAllowed: Dnum | null;
  maxLtv: Dnum;
  maxLtvAllowed: Dnum;
  redemptionRisk: RiskLevel | null;
};

export function getLoanDetails(
  deposit: Dnum | null,
  debt: Dnum | null,
  interestRate: Dnum | null,
  minCollRatio: number,
  collPrice: Dnum | null,
): LoanDetails {
  const maxLtv = dn.div(dn.from(1, 18), minCollRatio);
  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED);
  const depositUsd = deposit && collPrice ? dn.mul(deposit, collPrice) : null;

  const ltv = debt && deposit && collPrice && getLtv(deposit, debt, collPrice);
  const maxDebt = depositUsd && dn.mul(depositUsd, maxLtv);

  const maxDebtAllowed = depositUsd && dn.gt(depositUsd, 0)
    ? dn.mul(depositUsd, maxLtvAllowed)
    : null;

  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const leverageFactor = ltv && dn.lt(ltv, 1)
    ? getLeverageFactorFromLtv(ltv)
    : null;

  const depositPreLeverage = deposit === null || leverageFactor === null
    ? null
    : dn.div(deposit, leverageFactor);

  const liquidationPrice = deposit && debt && getLiquidationPrice(
    deposit,
    debt,
    minCollRatio,
  );

  return {
    debt,
    deposit,
    depositPreLeverage,
    depositUsd,
    collPrice,
    interestRate,
    leverageFactor,
    liquidationPrice,
    liquidationRisk,
    ltv,
    maxDebt,
    maxDebtAllowed,
    maxLtv,
    maxLtvAllowed,
    redemptionRisk,
  };
}
