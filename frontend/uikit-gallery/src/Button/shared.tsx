"use client";

import { Button } from "@liquity2/uikit";
import { useFixtureInput } from "react-cosmos/client";

const modes = ["primary", "secondary", "tertiary", "positive", "negative"] as const;

export function ButtonFixture({
  size,
}: {
  size: "mini" | "small" | "medium" | "large";
}) {
  const [wide] = useFixtureInput("wide", false);
  const [disabled] = useFixtureInput("disabled", false);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: wide ? "column" : "row",
        flexWrap: "wrap",
        width: wide && (size === "mini" || size === "small") ? 200 : wide ? 400 : 600,
        padding: size === "large" ? 32 : 16,
        gap: 16,
      }}
    >
      {modes.map((mode) => (
        <Button
          key={mode}
          label={mode.charAt(0).toUpperCase() + mode.slice(1)}
          mode={mode}
          size={size}
          wide={wide}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
