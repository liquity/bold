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
  return dn.div(
    dn.sub(leverageFactor, dn.from(1, 18)),
    leverageFactor,
  );
}

export function getLeverageFactorFromLtv(ltv: Dnum) {
  return Math.round(1 / (1 - dn.toNumber(ltv)) * 10) / 10;
}

// e.g. $4000 / ETH and 1.5x leverage = $3248.63 liq. price
export function getLeveragedLiquidationPrice(
  ethPrice: Dnum,
  leverage: number,
  collateralRatio: number,
) {
  return dn.div(
    dn.sub(dn.mul(leverage, ethPrice), ethPrice),
    dn.sub(leverage, dn.div(dn.from(1, 18), collateralRatio)),
  );
}

// e.g. $4000 / ETH and $3248.63 liq. price = 1.5x leverage
export function getLeverageFactorFromLiquidationPrice(
  ethPrice: Dnum,
  liquidationPrice: Dnum,
  collateralRatio: number,
) {
  return Math.round(
    dn.toNumber(dn.div(
      dn.sub(
        dn.mul(liquidationPrice, dn.div(dn.from(1, 18), collateralRatio)),
        ethPrice,
      ),
      dn.sub(liquidationPrice, ethPrice),
    )) * 10,
  ) / 10;
}

export function getLiquidationPriceUsd(
  deposit: Dnum | null,
  debt: Dnum | null,
  maxLtv: Dnum,
  ethPriceUsd: Dnum,
): Dnum | null {
  if (!deposit || !dn.gt(deposit, 0) || !debt || !dn.gt(debt, 0) || !dn.gt(maxLtv, 0)) {
    return null;
  }
  return dnumMin(dn.div(dn.mul(debt, maxLtv), deposit), ethPriceUsd);
}

export function getLtv(
  debt: Dnum,
  depositUsd: Dnum,
): Dnum {
  return dn.gt(depositUsd, 0)
    ? dn.div(debt, depositUsd)
    : dn.from(0, 18);
}

export type LoanDetails = {
  debt: Dnum | null;
  deposit: Dnum | null;
  depositUsd: Dnum | null;
  ethPriceUsd: Dnum;
  interestRate: Dnum | null;
  liquidationPriceUsd: Dnum | null;
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
  maxLtv: Dnum,
  ethPriceUsd: Dnum,
): LoanDetails {
  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED);
  const depositUsd = deposit && dn.mul(deposit, ethPriceUsd);

  const ltv = debt && depositUsd && getLtv(debt, depositUsd);
  const maxDebt = depositUsd && dn.mul(depositUsd, maxLtv);

  const maxDebtAllowed = depositUsd && dn.gt(depositUsd, 0)
    ? dn.mul(depositUsd, maxLtvAllowed)
    : null;

  const liquidationPriceUsd = getLiquidationPriceUsd(deposit, debt, maxLtv, ethPriceUsd);
  const liquidationRisk = ltv && deposit && dn.gt(deposit, 0) && debt && dn.gt(debt, 0)
    ? getLiquidationRisk(ltv, maxLtv)
    : null;
  const redemptionRisk = getRedemptionRisk(interestRate);

  return {
    debt,
    deposit,
    depositUsd,
    ethPriceUsd,
    interestRate,
    liquidationPriceUsd,
    liquidationRisk,
    ltv,
    maxDebt,
    maxDebtAllowed,
    maxLtv,
    maxLtvAllowed,
    redemptionRisk,
  };
}
