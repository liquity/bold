"use client";

import type { Property } from "@/styled-system/types/csstype";

import { palette } from "@/src/colors";
import { PercentageBars } from "@/src/comps/PercentageBars/PercentageBars";
import { css } from "@/styled-system/css";
import { match } from "ts-pattern";

export default function Borrow() {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      })}
    >
      <div>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            paddingBottom: 16,
            fontSize: 24,
          })}
        >
          <div>Interest rate</div>
          <div>5.00%</div>
        </div>
        <PercentageBars />
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            paddingTop: 12,
          })}
        >
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
      className={css({
        fontSize: 10,
      })}
      style={{
        textAlign: (
          match(align)
            .returnType<Property.TextAlign>()
            .with("start", () => "left")
            .with("end", () => "right")
            .otherwise(() => "center")
        ),
      }}
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
