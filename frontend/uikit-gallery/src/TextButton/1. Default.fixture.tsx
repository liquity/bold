"use client";

import { TextButton } from "@liquity2/uikit";
import { useFixtureInput } from "react-cosmos/client";

export default function TextButtonFixture() {
  const [label] = useFixtureInput("label", "TextButton");
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        padding: 16,
      }}
    >
      <TextButton
        label={label}
      />
    </div>
  );
}
