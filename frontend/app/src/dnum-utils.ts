import type { Dnum, Numberish } from "dnum";

import * as dn from "dnum";

export const DNUM_0 = dn.from(0, 18);
export const DNUM_1 = dn.from(1, 18);

export function dnum18(value: null | undefined): null;
export function dnum18(value: string | bigint | number): Dnum;
export function dnum18(value: string | bigint | number | null | undefined): Dnum | null;
export function dnum18(value: string | bigint | number | null | undefined): Dnum | null {
  return value === undefined || value === null ? null : [BigInt(value), 18];
}

export function dnumOrNull(value: Numberish | null | undefined, decimals: number): Dnum | null {
  if (value == null || value === undefined) {
    return null;
  }
  try {
    return dn.from(value, decimals);
  } catch {
    return null;
  }
}

export function dnumMax(a: Dnum, ...rest: Dnum[]) {
  return rest.reduce((max, value) => dn.gt(value, max) ? value : max, a);
}

export function dnumMin(a: Dnum, ...rest: Dnum[]) {
  return rest.reduce((min, value) => dn.lt(value, min) ? value : min, a);
}

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
