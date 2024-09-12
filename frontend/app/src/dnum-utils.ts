import type { Dnum } from "dnum";

import * as dn from "dnum";

export function dnum18(value: string | bigint | number): Dnum {
  return [BigInt(value), 18];
}

export function formatAmountCompact(value: Dnum, digits: number = 2) {
  const valueAbs = dn.abs(value);
  if (dn.eq(valueAbs, 1e9) || dn.gt(valueAbs, 1e9)) {
    return dn.format(dn.div(value, 1e9, 18), digits) + "B";
  }
  if (dn.eq(valueAbs, 1e6) || dn.gt(valueAbs, 1e6)) {
    return dn.format(dn.div(value, 1e6, 18), digits) + "M";
  }
  if (dn.eq(valueAbs, 1e3) || dn.gt(valueAbs, 1e3)) {
    return dn.format(dn.div(value, 1e3, 18), digits) + "K";
  }
  return dn.format(value, digits);
}

export function formatPercentage(
  value?: Dnum | number | null,
  {
    clamp = false,
    digits = 2,
    trailingZeros = true,
  }: {
    clamp?: boolean | [Dnum, Dnum];
    digits?: number;
    trailingZeros?: boolean;
  } = {},
) {
  if (typeof value === "number") {
    value = dn.from(value, 18);
  }
  if (!value) {
    return "−";
  }
  if (clamp === true) {
    clamp = [DNUM_0, DNUM_1];
  }
  if (clamp && dnumLte(value, clamp[0])) {
    return "0%";
  }
  if (clamp && dnumGte(value, clamp[1])) {
    return "100%";
  }
  return `${
    dn.format(dn.mul(value, 100), {
      digits,
      trailingZeros,
    })
  }%`;
}

export function dnumMax(a: Dnum, ...rest: Dnum[]) {
  return rest.reduce((max, value) => dn.gt(value, max) ? value : max, a);
}

export function dnumMin(a: Dnum, ...rest: Dnum[]) {
  return rest.reduce((min, value) => dn.lt(value, min) ? value : min, a);
}

export function dnumGte(a: Dnum, b: Dnum) {
  return dn.gt(a, b) || dn.eq(a, b);
}

export function dnumLte(a: Dnum, b: Dnum) {
  return dn.lt(a, b) || dn.eq(a, b);
}

export const DNUM_0 = dn.from(0, 18);
export const DNUM_1 = dn.from(1, 18);

export const jsonStringifyWithDnum: typeof JSON.stringify = (data, replacer, space) => {
  return JSON.stringify(
    data,
    (key, value) => {
      const value_ = dn.isDnum(value) ? `dn${dn.toJSON(value)}` : value;
      return typeof replacer === "function" ? replacer(key, value_) : value_;
    },
    space,
  );
};

export const jsonParseWithDnum: typeof JSON.parse = (data, reviver) => {
  return JSON.parse(
    data,
    (key, value) => {
      if (typeof value === "string" && value.startsWith("dn[\"")) {
        return dn.fromJSON(value.slice(2));
      }
      return typeof reviver === "function" ? reviver(key, value) : value;
    },
  );
};
