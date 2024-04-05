import { ADDRESS_ZERO, isAddress } from "@/src/eth-utils";
import * as dn from "dnum";

const inputValueRegex = /^[0-9]*\.?[0-9]*?$/;
export function isInputValueFloat(value: string) {
  value = value.trim();
  return inputValueRegex.test(value);
}

export function parseInputValue(value: string) {
  value = value.trim();

  if (!isInputValueFloat(value)) {
    return null;
  }

  value = value
    .replace(/\.$/, "")
    .replace(/^\./, "0.");

  return dn.from(value === "" ? 0 : value, 18);
}

export function parseInputPercentage(value: string) {
  const parsedValue = parseInputValue(value);
  if (parsedValue === null || dn.lt(parsedValue, 0) || dn.gt(parsedValue, 100)) {
    return null;
  }
  return dn.div(parsedValue, 100);
}

export function parseInputAddress(value: string) {
  value = value.trim();
  return isAddress(value) ? value : ADDRESS_ZERO;
}
