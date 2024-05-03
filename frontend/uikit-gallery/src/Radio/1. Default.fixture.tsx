"use client";

import { Radio, RadioGroup } from "@liquity2/uikit";
import { useState } from "react";
import type { ReactNode } from "react";

export default function RadioFixture() {
  const [selected, setSelected] = useState(0);
  const options = ["Option 1", "Option 2", "Option 3"];

  return (
    <RadioGroup onChange={setSelected} selected={selected}>
      {options.map((label, index) => (
        <Label key={index}>
          <Radio index={index} /> {label}
        </Label>
      ))}
    </RadioGroup>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        height: 32,
        gap: 8,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {children}
    </label>
  );
}
