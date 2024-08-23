import type { Dnum } from "dnum";

import * as dn from "dnum";
import { expect, test } from "vitest";
import {
  getLeverageFactorFromLiquidationPrice,
  getLeverageFactorFromLtv,
  getLiquidationPrice,
  getLiquidationPriceFromLeverage,
  getLiquidationRisk,
  getLtv,
  getLtvFromLeverageFactor,
  getRedemptionRisk,
} from "./liquity-math";

const d = (value: number | bigint): Dnum => (
  typeof value === "bigint"
    ? [value, 18]
    : dn.from(value, 18)
);

test("getRedemptionRisk() works", () => {
  // From constants.ts:
  //  up to 3.5% => high
  //  >3.5% up to 5% = medium
  //  >5% = low

  const interest = (value: number) => d(value / 100);

  expect(getRedemptionRisk(null)).toBe(null);

  expect(getRedemptionRisk(interest(-1))).toBe("high");
  expect(getRedemptionRisk(interest(0))).toBe("high");

  expect(getRedemptionRisk(interest(3.49))).toBe("high");
  expect(getRedemptionRisk(interest(3.50))).toBe("high");
  expect(getRedemptionRisk(interest(3.51))).toBe("medium");

  expect(getRedemptionRisk(interest(4.99))).toBe("medium");
  expect(getRedemptionRisk(interest(5.00))).toBe("medium");
  expect(getRedemptionRisk(interest(5.01))).toBe("low");

  expect(getRedemptionRisk(interest(10))).toBe("low");
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
  expect(() => getLtvFromLeverageFactor(0)).toThrowError();
  expect(() => getLtvFromLeverageFactor(-1)).toThrowError();

  for (const [leverageFactor, expected] of leverageToLtvPairs) {
    expect(getLtvFromLeverageFactor(leverageFactor)).toEqual(expected);
  }
});

test("getLeverageFactorFromLtv() works", () => {
  for (const [leverageFactor, ltv] of leverageToLtvPairs) {
    expect(getLeverageFactorFromLtv(ltv)).toEqual(leverageFactor);
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
  ).toEqual(d(1200));
  expect(
    getLiquidationPrice(d(8), d(8000), 1.1),
  ).toEqual(d(1100));
});

test("getLtv() works", () => {
  expect(getLtv(d(-8), d(1000), d(2000))).toBe(null);
  expect(getLtv(d(8), d(1000), d(2000))).toEqual(d(0.0625));
  expect(getLtv(d(8), d(16000), d(2000))).toEqual(d(1));
  expect(getLtv(d(8), d(32000), d(2000))).toEqual(d(2));
});
