import type { Dnum } from "dnum";

import * as dn from "dnum";
import { expect, test } from "vitest";
import {
  getLeverageFactorFromLiquidationPrice,
  getLeverageFactorFromLtv,
  getLiquidationPrice,
  getLiquidationPriceFromLeverage,
  getLiquidationRisk,
  getLoanDetails,
  getLtv,
  getLtvFromLeverageFactor,
  getRedemptionRisk,
} from "./liquity-math";
import { roundToDecimal } from "./utils";

// equality check for dnums
expect.addEqualityTesters([
  (a: unknown, b: unknown): boolean | undefined => {
    const isANumberIsh = typeof a === "number" || typeof a === "bigint" || dn.isDnum(a);
    const isBNumberIsh = typeof b === "number" || typeof b === "bigint" || dn.isDnum(b);
    return isANumberIsh && isBNumberIsh ? dn.eq(a, b) : undefined;
  },
]);

const d = (value: number | bigint): Dnum => (
  typeof value === "bigint"
    ? [value, 18]
    : dn.from(value, 18)
);

test("getRedemptionRisk() works", () => {
  const totalDebt = d(1_000_000); // 1M total debt

  expect(getRedemptionRisk(null, totalDebt)).toBe(null);
  expect(getRedemptionRisk(d(100_000), null)).toBe(null);
  expect(getRedemptionRisk(null, null)).toBe(null);
  expect(getRedemptionRisk(d(100_000), d(0))).toBe(null);

  // high risk: low debtInFront ratio
  expect(getRedemptionRisk(d(0), totalDebt)).toBe("high");
  expect(getRedemptionRisk(d(10_000), totalDebt)).toBe("high"); // 1% ratio

  // medium risk: medium debtInFront ratio
  expect(getRedemptionRisk(d(400_000), totalDebt)).toBe("medium"); // 40% ratio

  // low risk: high debtInFront ratio
  expect(getRedemptionRisk(d(800_000), totalDebt)).toBe("low"); // 80% ratio
  expect(getRedemptionRisk(d(900_000), totalDebt)).toBe("low"); // 90% ratio
});

test("getLiquidationRisk() works", () => {
  // From constants.ts:
  //  up to 54% = low
  //  >54% up to 73% = medium
  //  >73% = high

  const maxLtv = d(100 / 110);
  const ltv = (value: number) => dn.mul(d(value), maxLtv);

  expect(getLiquidationRisk(ltv(-1), maxLtv)).toBe("low");
  expect(getLiquidationRisk(ltv(0), maxLtv)).toBe("low");

  expect(getLiquidationRisk(ltv(0.539), maxLtv)).toBe("low");
  expect(getLiquidationRisk(ltv(0.540), maxLtv)).toBe("low");
  expect(getLiquidationRisk(ltv(0.541), maxLtv)).toBe("medium");

  expect(getLiquidationRisk(ltv(0.729), maxLtv)).toBe("medium");
  expect(getLiquidationRisk(ltv(0.730), maxLtv)).toBe("medium");
  expect(getLiquidationRisk(ltv(0.731), maxLtv)).toBe("high");

  expect(getLiquidationRisk(ltv(1), maxLtv)).toBe("high");
  expect(getLiquidationRisk(ltv(2), maxLtv)).toBe("high");
});

const leverageToLtvPairs = [
  [1, d(0n)], //                    1x   => 0%
  [1.1, d(90909090909090909n)], //  1.1x => 9.09…%
  [1.5, d(333333333333333333n)], // 1.5x => 33.33…%
  [2, d(500000000000000000n)], //   2x   => 50%
  [3, d(666666666666666667n)], //   3x   => 66.66…%
  [10, d(900000000000000000n)], //  10x  => 90%
  [11, d(909090909090909091n)], //  11x  => 90.90…%
  [100, d(990000000000000000n)], // 100x => 99%
] as const;

test("getLtvFromLeverageFactor() works", () => {
  expect(getLtvFromLeverageFactor(0)).toBeNull();
  expect(getLtvFromLeverageFactor(-1)).toBeNull();

  for (const [leverageFactor, expected] of leverageToLtvPairs) {
    expect(getLtvFromLeverageFactor(leverageFactor)).toEqual(expected);
  }
});

test("getLeverageFactorFromLtv() works", () => {
  for (const [leverageFactor, ltv] of leverageToLtvPairs) {
    expect(roundToDecimal(getLeverageFactorFromLtv(ltv), 1)).toEqual(leverageFactor);
  }
});

const loans = [{
  leverage: 2.5,
  collPrice: d(2000),
  minCollRatio: 1.1,
  deposit: d(1),
  borrowed: d(1200),
  liquidationPrice: d(1320),
}, {
  leverage: 2.5,
  collPrice: d(2000),
  minCollRatio: 1.2,
  deposit: d(1),
  borrowed: d(1200),
  liquidationPrice: d(1440),
}, {
  leverage: 2,
  collPrice: d(1000),
  minCollRatio: 1.1,
  deposit: d(1),
  borrowed: d(500),
  liquidationPrice: d(550),
}, {
  leverage: 3,
  collPrice: d(1500),
  minCollRatio: 1.2,
  deposit: d(1),
  borrowed: d(1000),
  liquidationPrice: d(1200),
}, {
  leverage: 1.5,
  collPrice: d(3000),
  minCollRatio: 1.25,
  deposit: d(1),
  borrowed: d(1000),
  liquidationPrice: d(1250),
}] as const;

test("getLiquidationPriceFromLeverage() works", () => {
  for (const loan of loans) {
    expect(getLiquidationPriceFromLeverage(
      loan.leverage,
      loan.collPrice,
      loan.minCollRatio,
    )).toEqual(loan.liquidationPrice);
  }
});

test("getLeverageFactorFromLiquidationPrice() works", () => {
  for (const loan of loans) {
    expect(getLeverageFactorFromLiquidationPrice(
      loan.liquidationPrice,
      loan.collPrice,
      loan.minCollRatio,
    )).toEqual(loan.leverage);
  }
});

test("getLiquidationPrice() works", () => {
  expect(
    getLiquidationPrice(d(8), d(8000), 1.2),
  ).toEqual(1200);
  expect(
    getLiquidationPrice(d(8), d(8000), 1.1),
  ).toEqual(1100);
});

test("getLtv() works", () => {
  expect(getLtv(d(-8), d(1000), d(2000))).toBe(null);
  expect(getLtv(d(8), d(1000), d(2000))).toEqual(0.0625);
  expect(getLtv(d(8), d(16000), d(2000))).toEqual(1);
  expect(getLtv(d(8), d(32000), d(2000))).toEqual(2);
});

test("getLoanDetails() correctly calculates isUnderwater and isLiquidatable in leveraged positions", () => {
  const loan = (deposit: number, borrowed: number, collPrice: number) => (
    getLoanDetails(
      d(deposit),
      d(borrowed),
      d(0.05),
      1.1, // 110% collateral = 90.9090…% max. LTV
      d(collPrice),
    )
  );

  // healthy position (50% LTV)
  const healthyLoan = loan(10, 10000, 2000);
  expect(healthyLoan.ltv).toEqual(0.5);
  expect(healthyLoan.leverageFactor).toBe(2);
  expect(healthyLoan.status).toBe("healthy");

  // almost liquidatable (90% LTV)
  const almostLiquidatableLoan = loan(10, 18000, 2000);
  expect(almostLiquidatableLoan.ltv).toEqual(0.9);
  expect(almostLiquidatableLoan.leverageFactor).toBeCloseTo(10);
  expect(almostLiquidatableLoan.depositPreLeverage).toEqual(d(999999999999999800n)); // ~1 ETH
  expect(almostLiquidatableLoan.status).toBe("at-risk");
  expect(almostLiquidatableLoan.ltv && dn.lt(almostLiquidatableLoan.ltv, almostLiquidatableLoan.maxLtv)).toBe(true);

  // liquidatable (91% LTV)
  const liquidatableLoan = loan(10, 18200, 2000);
  expect(liquidatableLoan.ltv).toEqual(0.91);
  expect(liquidatableLoan.leverageFactor).toBeCloseTo(11.11);
  expect(liquidatableLoan.depositPreLeverage).toEqual(d(899999999999999766n)); // ~0.9 ETH
  expect(liquidatableLoan.status).toBe("liquidatable");
  expect(liquidatableLoan.ltv && dn.gt(liquidatableLoan.ltv, liquidatableLoan.maxLtv)).toBe(true);

  // exactly at 100% LTV
  const oneHundredPercentLtvLoan = loan(10, 20000, 2000);
  expect(oneHundredPercentLtvLoan.ltv).toEqual(1);
  expect(oneHundredPercentLtvLoan.leverageFactor).toBe(Number.POSITIVE_INFINITY);
  expect(oneHundredPercentLtvLoan.depositPreLeverage).toEqual(null);
  expect(oneHundredPercentLtvLoan.status).toBe("liquidatable");

  // underwater (>100% LTV)
  const oneHundredPercentLtvPlusLoan = loan(10, 20000.00000000001, 2000);
  expect(oneHundredPercentLtvPlusLoan.status).toBe("underwater");

  // underwater (125% LTV)
  const underwaterLoan = loan(10, 25000, 2000);
  expect(underwaterLoan.ltv).toEqual(1.25);
  expect(underwaterLoan.leverageFactor).toBe(-4); // negative leverage
  expect(underwaterLoan.depositPreLeverage).toEqual(-2.5); // -2.5 ETH missing to recover
  expect(underwaterLoan.depositToZero).toEqual(2.5); // 2.5 ETH to zero out the position
  expect(underwaterLoan.deposit).toEqual(10);
  expect(underwaterLoan.status).toBe("underwater");
});
