"use client";

import { Slider } from "@liquity2/uikit";
import { useState } from "react";

export default function SliderFixture() {
  const [value, setValue] = useState(0.5);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
      }}
    >
      <Slider
        gradient={[1 / 3, 2 / 3]}
        onChange={setValue}
        value={value}
      />
    </div>
  );
}
