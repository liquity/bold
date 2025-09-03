import { parseUnits } from "viem";
import { arbitrum } from "viem/chains";

export const CHAIN = arbitrum;

export const ORIGIN_BLOCK = 356661348n;

export const MINIMUM_BALANCE_THRESHOLD = {
  yusnd: parseUnits("0.0001", 18),
  spectra: parseUnits("0.0001", 18),
  camelot: parseUnits("0.0001", 18),
  bunni: parseUnits("0.0001", 18),
}

export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000" as const;