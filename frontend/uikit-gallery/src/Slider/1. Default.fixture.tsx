"use client";

import { Slider } from "@liquity2/uikit";
import { useState } from "react";

export default function SliderFixture() {
  const [value, setValue] = useState(0.5);
  return (
    <Slider
      onChange={setValue}
      value={value}
    />
  );
}
