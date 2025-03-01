"use client";

import { Slider } from "@liquity2/uikit";
import { useState } from "react";

const RATE_START = 50n; // 0.5%
const RATE_END = 2500n; // 25%
const RATE_INCREMENT = 50n; // 0.5% increments (normal)
const RATE_PRECISE_INCREMENT = 10n; // 0.1% increments (precise)
const RATE_PRECISE_UNTIL = 1000n; // use precise increments until

type Bar = {
  size: number; // 0 to 1
  rate: bigint; // interest rate (in basis points, 100 = 1%)
};

const CHART: Bar[] = [];

function getSize() {
  let roll = Math.random();

  // 3% chances of huge spike
  if ((roll -= 0.03) < 0) {
    return 0.5 + Math.random();
  }

  // 2% chances of a normal spike
  if ((roll -= 0.02) < 0) {
    return 0.5 + Math.random() * 0.5;
  }

  // 70% chances of being 0
  if ((roll -= 0.7) < 0) {
    return 0;
  }

  return Math.random() * 0.2;
}

let currentRate = RATE_START;
while (currentRate <= RATE_END) {
  CHART.push({ size: getSize(), rate: currentRate });
  currentRate += currentRate < RATE_PRECISE_UNTIL
    ? RATE_PRECISE_INCREMENT
    : RATE_INCREMENT;
}

const { format: formatPct } = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const { format: formatBefore } = new Intl.NumberFormat("en-US", {
  style: "decimal",
  compactDisplay: "short",
  notation: "compact",
  minimumFractionDigits: 2,
  maximumSignificantDigits: 3,
});

export default function SliderFixture() {
  const [index, setIndex] = useState(Math.floor(CHART.length / 2));
  const before = CHART.slice(0, index).reduce((s, { size }) => s + size, 0) * 1_000_000;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          width: 120,
          paddingTop: 4,
          paddingRight: 24,
          fontSize: "28px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div>{formatPct(Number(CHART[index].rate) / 10_000)}</div>
        <div
          style={{
            marginTop: -8,
            fontSize: "16px",
            whiteSpace: "nowrap",
          }}
        >
          {formatBefore(before)} before
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: 300,
        }}
      >
        <Slider
          chart={CHART.map((bar) => bar.size)}
          gradient={[
            Math.round(0.3 * CHART.length) / CHART.length,
            Math.round(0.7 * CHART.length) / CHART.length,
          ]}
          gradientMode="high-to-low"
          onChange={(value) => {
            setIndex(Math.round(value * (CHART.length - 1)));
          }}
          value={index / CHART.length}
        />
      </div>
    </div>
  );
}
