import { eq } from "dnum";

import type { Address } from "@liquity2/uikit";
import type { VoteAllocations } from '@/src/types';

export const isAllocationsChanged = (a: VoteAllocations, b: VoteAllocations) => {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) return true;

  for (let i = 0; i < keysA.length; i++) {
    const keyA = keysA[i] as Address;
    const keyB = keysB[i] as Address;

    if (keyA !== keyB) return true;

    const valA = a[keyA];
    const valB = b[keyB];

    if (!valA?.vote || !valB?.vote) return true;

    if (valA.vote !== valB?.vote || !eq(valA?.value, valB?.value)) return true;
  }

  return false;
}
