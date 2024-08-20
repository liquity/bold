"use client";

import { Slider } from "@liquity2/uikit";
import { useState } from "react";

const CHART_TMP = Array.from({ length: 50 }, () => (
  Math.random() * 0.8 + 0.2
));

export default function SliderFixture() {
  const [value, setValue] = useState(0.5);
  return (
    <Slider
      chart={CHART_TMP}
      gradient={[1 / 3, 2 / 3]}
      onChange={setValue}
      value={value}
    />
  );
}
