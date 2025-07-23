import type { Address, CollIndex } from "@/src/types";
import type { Dnum } from "dnum";
import type { BatchManager } from "@/src/summerstone-graphql/graphql";
import { Delegate } from "@/src/types";

export type DelegateMode = "manual" | "strategy" | "delegate" | "managed";

export type Manager = {
  name: string;
  logo: string;
  link: string;
};

export type RecommendedDelegate = {
  manager: Manager;
  delegate: Delegate;
  status: BatchManager;
};

export interface InterestRateFieldProps {
  branchId: CollIndex;
  debt: Dnum | null;
  delegate: Address | null;
  inputId?: string;
  interestRate: Dnum | null;
  mode: DelegateMode;
  onChange: (interestRate: Dnum) => void;
  onDelegateChange: (delegate: Address | null) => void;
  onModeChange?: (mode: DelegateMode) => void;
  onAverageInterestRateLoad?: (averageInterestRate: Dnum) => void;
}

export const DELEGATE_MODES: DelegateMode[] = [
  "manual",
  "managed",
  "delegate",
  // "strategy",
];

export const SUMMERSTONE_MANAGER: Manager = {
  name: "Summerstone",
  logo: "https://summerstone.xyz/static/images/mark-transparent-xxxs.png",
  link: "https://summerstone.xyz/docs/for-users/managed-interest-rates",
}; 