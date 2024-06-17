import type { Dnum } from "dnum";

import * as dn from "dnum";

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
