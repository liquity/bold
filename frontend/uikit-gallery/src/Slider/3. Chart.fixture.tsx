"use client";

import { Slider } from "@liquity2/uikit";
import { useState } from "react";

const CHART_TMP = Array.from({ length: 50 }, () => (
  Math.random() * 0.8 + 0.2
));

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
        chart={CHART_TMP}
        onChange={setValue}
        value={value}
      />
    </div>
  );
}
