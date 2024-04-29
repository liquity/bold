"use client";

import { PillButton } from "@liquity2/uikit";
import { useFixtureInput, useFixtureSelect } from "react-cosmos/client";
import { match } from "ts-pattern";

export function PillButtonFixture({
  fixture,
}: {
  fixture: "low" | "medium" | "high";
}) {
  const [label] = useFixtureInput(
    "label",
    match(fixture)
      .with("low", () => "6.5%")
      .with("medium", () => "5.0%")
      .with("high", () => "3.5%")
      .exhaustive(),
  );
  const [warnLevel] = useFixtureSelect("warnLevel", {
    options: ["low", "medium", "high"],
    defaultValue: fixture,
  });
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: 608,
        padding: 16,
      }}
    >
      <PillButton
        label={label}
        warnLevel={warnLevel}
      />
    </div>
  );
}
