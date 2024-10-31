import type { RiskLevel } from "@/src/types";
import type { StatusMode } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { match } from "ts-pattern";

export function riskLevelToStatusMode(level?: RiskLevel | null): StatusMode {
  return match(level)
    .returnType<StatusMode>()
    .with("low", () => "positive")
    .with("medium", () => "warning")
    .with("high", () => "negative")
    .otherwise(() => "neutral");
}

// InfoTooltip props from a heading & children tuple.
// This is used to provide tooltip props from the content.tsx file in a concise way.
export function infoTooltipProps(
  data: readonly ReactNode[],
): {
  heading?: ReactNode;
  children: ReactNode;
} {
  return data.length > 1
    ? { heading: data[0], children: data[1] }
    : { children: data[0] };
}
