"use client";

import { palette } from "@/src/colors";
import { PercentageBars } from "@/src/comps/PercentageBars/PercentageBars";
import * as stylex from "@stylexjs/stylex";
import { match } from "ts-pattern";

const styles = stylex.create({
  base: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  interestRateHeader: {
    display: "flex",
    justifyContent: "space-between",
    paddingBottom: 16,
    fontSize: 24,
  },
  riskLabels: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  riskLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  riskLabelStart: {
    textAlign: "left",
  },
  riskLabelEnd: {
    textAlign: "right",
  },
});

export default function Borrow() {
  return (
    <div {...stylex.props(styles.base)}>
      <div>
        <div {...stylex.props(styles.interestRateHeader)}>
          <div>Interest rate</div>
          <div>5.00%</div>
        </div>
        <PercentageBars />
        <div {...stylex.props(styles.riskLabels)}>
          <RiskLabel
            align="start"
            label="Highest risk"
            rate="0.5%"
          />
          <RiskLabel
            align="center"
            label="Average"
            rate="5.0%"
          />
          <RiskLabel
            align="end"
            label="Lowest risk"
            rate="10.0%"
          />
        </div>
      </div>
    </div>
  );
}

function RiskLabel({
  align = "start",
  label,
  rate,
}: {
  align?: "start" | "end" | "center";
  label: string;
  rate: string;
}) {
  return (
    <div
      {...stylex.props(
        styles.riskLabel,
        match(align)
          .with("start", () => styles.riskLabelStart)
          .with("end", () => styles.riskLabelEnd)
          .otherwise(() => ({})),
      )}
    >
      <div style={{ color: palette.rain }}>
        {label}
      </div>
      <div>
        {rate}
      </div>
    </div>
  );
}
