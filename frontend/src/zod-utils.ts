import { isAddress } from "@/src/eth-utils";
import z from "zod";

export function zAddress() {
  return z.string().transform((value: string, { addIssue }) => {
    if (!isAddress(value)) {
      addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value} is not a valid Ethereum address`,
      });
      return z.NEVER;
    }
    return value;
  });
}
