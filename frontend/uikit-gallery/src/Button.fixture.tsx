"use client";

import { Button } from "@liquity2/uikit";
import { useFixtureInput, useFixtureSelect } from "react-cosmos/client";

export default function ButtonFixture() {
  const [label] = useFixtureInput("label", "Button");
  const [mode] = useFixtureSelect("mode", {
    options: ["primary", "secondary", "positive", "negative"],
    defaultValue: "secondary",
  });
  const [size] = useFixtureSelect("size", {
    options: ["medium", "large"],
    defaultValue: "medium",
  });
  const [wide] = useFixtureInput("wide", false);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        padding: 16,
      }}
    >
      <Button
        label={label}
        mode={mode}
        size={size}
        wide={wide}
      />
    </div>
  );
}
