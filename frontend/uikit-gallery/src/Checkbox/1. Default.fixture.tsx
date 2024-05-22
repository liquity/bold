"use client";

import type { ReactNode } from "react";

import { Checkbox } from "@liquity2/uikit";
import { useState } from "react";

const options = ["Option 1", "Option 2", "Option 3"];

export default function CheckboxFixture() {
  return (
    <div>
      {options.map((label, index) => (
        <CheckboxField
          key={index}
          label={label}
        />
      ))}
    </div>
  );
}

function CheckboxField({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  const toggle = () => setChecked((c) => !c);
  return (
    <Label>
      <Checkbox
        checked={checked}
        onChange={toggle}
      />
      {label}
    </Label>
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
