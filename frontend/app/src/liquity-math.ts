import type { RiskLevel } from "@/src/types";
import type { Dnum } from "dnum";

import { LTV_RISK, MAX_LTV_ALLOWED, REDEMPTION_RISK } from "@/src/constants";
import { dnumMin } from "@/src/dnum-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

export function getRedemptionRisk(interest: Dnum | null): null | RiskLevel {
  return match(interest)
    .returnType<RiskLevel | null>()
    .with(P.nullish, () => null)
    .when((r) => dn.eq(r, 0), () => null)
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

export function getLiquidationRiskFromLeverageFactor(
  leverageFactor: number,
  mediumRiskLeverageFactor: number,
  highRiskLeverageFactor: number,
) {
  return match(leverageFactor)
    .returnType<RiskLevel>()
    .when((lf) => lf >= highRiskLeverageFactor, () => "high")
    .when((ltv) => ltv >= mediumRiskLeverageFactor, () => "medium")
    .otherwise(() => "low");
}

export function getLtvFromLeverageFactor(leverageFactor: number) {
  return leverageFactor === 0 ? dn.from(0, 18) : dn.div(
    dn.sub(leverageFactor, dn.from(1, 18)),
    leverageFactor,
  );
}

export function getLeverageFactorFromLtv(ltv: null): null;
export function getLeverageFactorFromLtv(ltv: Dnum): number;
export function getLeverageFactorFromLtv(ltv: null | Dnum): null | number;
export function getLeverageFactorFromLtv(ltv: null | Dnum): null | number {
  return (ltv === null ? null : Math.round(1 / (1 - dn.toNumber(ltv)) * 10) / 10);
}

export function getLeveragedLiquidationPrice(
  collPrice: Dnum,
  leverage: number,
  collRatio: number,
) {
  return dn.div(
    dn.mul(dn.mul(collPrice, leverage - 1), collRatio),
    leverage,
  );
}

export function getLeverageFactorFromLiquidationPrice(
  collPrice: Dnum,
  liquidationPrice: Dnum,
  collRatio: number,
): number {
  const collPriceRatio = dn.mul(collPrice, collRatio);
  const denominator = dn.sub(collPriceRatio, liquidationPrice);

  if (dn.eq(denominator, 0)) {
    return 1; // no leverage
  }

  const factor = dn.div(collPriceRatio, denominator);
  return Math.round(dn.toNumber(factor) * 10) / 10;
}

export function getLiquidationPrice({
  deposit,
  debt,
  maxLtv,
  collPrice,
}: {
  deposit: Dnum | null;
  debt: Dnum | null;
  maxLtv: Dnum;
  collPrice: Dnum;
}): Dnum | null {
  return (!deposit || !dn.gt(deposit, 0) || !debt || !dn.gt(debt, 0) || !dn.gt(maxLtv, 0))
    ? null
    : dnumMin(dn.div(dn.mul(debt, maxLtv), deposit), collPrice);
}

export function getLtv(
  debt: Dnum,
  depositUsd: Dnum,
): Dnum | null {
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
  collRatio: number,
  collPrice: Dnum | null,
): LoanDetails {
  const maxLtv = dn.div(dn.from(1, 18), collRatio);
  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED);
  const depositUsd = (deposit && collPrice) ? dn.mul(deposit, collPrice) : null;

  const ltv = debt && depositUsd && getLtv(debt, depositUsd);
  const maxDebt = depositUsd && dn.mul(depositUsd, maxLtv);

  const maxDebtAllowed = depositUsd && dn.gt(depositUsd, 0)
    ? dn.mul(depositUsd, maxLtvAllowed)
    : null;

  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const leverageFactor = (ltv && dn.lt(ltv, 1))
    ? getLeverageFactorFromLtv(ltv)
    : null;

  const depositPreLeverage = (leverageFactor === null || deposit === null)
    ? null
    : dn.div(deposit, leverageFactor);

  const liquidationPrice = (collPrice === null || leverageFactor === null) ? null : getLeveragedLiquidationPrice(
    collPrice,
    leverageFactor,
    collRatio,
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
