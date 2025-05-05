"use client";

import { palette } from "@/src/colors";
import { css } from "@/styled-system/css";
import { a, useSpring, useTransition } from "@react-spring/web";
import { useId } from "react";

const defaultValues = [
  5,
  8,
  9.2,
  14,
  15,
  16.1,
  18,
  18.4,
  18.4,
  20,
  20.7,
  23,
  24,
  25.3,
  28,
  31,
  33,
  36.8,
  40,
  42,
  44,
  45,
  46,
  47,
  48,
  49,
  44,
  41,
  36.8,
  34,
  31,
  29,
  28,
  26,
  25.3,
  24,
  22,
  20,
  17,
  14,
  12,
  11,
  10,
  10,
  6.9,
  5.75,
  5.75,
  2.3,
  13.8,
  13.8,
  2.3,
].map((value) => value / 49);

export function PercentageBars({
  activeIndex = Math.floor(49 / 2),
  values = defaultValues,
}: {
  activeIndex?: number;
  values?: number[];
}) {
  const width = 658;
  const height = 49;
  const barsGap = 2;
  const barWidth = (width - barsGap * values.length - 1) / values.length;
  const gapWidth = barsGap * values.length / (values.length - 1);

  const barsTransitions = useTransition(values.map((v, i) => [v, i]), {
    keys: ([_, i]) => i as number, // guaranteed, defined by the map above
    from: { scaleY: 0 },
    enter: { scaleY: 1 },
    config: { mass: 2, tension: 1200, friction: 50 },
    trail: 3,
  });

  const barsReveal = useSpring({
    from: {
      scaleX: 0,
    },
    to: {
      scaleX: 1,
    },
    config: { mass: 1, tension: 1000, friction: 80 },
  });

  const revealMaskId = useId();
  const barsMaskId = useId();
  const gradientId = useId();

  return (
    <div
      style={{ height }}
      className={css({
        position: "relative",
        display: "flex",
        width: "100%",
      })}
    >
      <svg
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        className={css({
          width: "100%",
          height: "auto",
        })}
      >
        <mask id={revealMaskId}>
          <a.rect
            fill="#fff"
            height={height}
            style={barsReveal}
            width={width}
            x={0}
            y={0}
          />
        </mask>

        <mask id={barsMaskId}>
          {barsTransitions((props, [value], _state, index) =>
            value !== undefined && ( // type guard, should never be undefined
              (<a.rect
                key={index}
                fill="#fff"
                height={value * height}
                mask={`url(#${revealMaskId})`}
                width={barWidth}
                x={index * barWidth + index * gapWidth}
                y={(1 - value) * height}
                style={props}
                className={css({
                  transformOrigin: "0 100%",
                })}
              />)
            )
          )}
        </mask>

        <a.linearGradient id={gradientId}>
          <stop offset="0%" stopColor="#FFEB81" />
          <stop offset="26%" stopColor="#BEEC86" />
          <stop offset="55%" stopColor="#63D77D" />
        </a.linearGradient>

        <g mask={`url(#${barsMaskId})`}>
          <path
            d={`
              M 0 ${height}
              L ${width} ${height}
              L ${width} 0
              L 0 0
              Z
            `}
            fill={`url(#${gradientId})`}
          />
          <rect
            fill={palette.blue}
            height={height}
            width={barWidth}
            x={activeIndex * barWidth + activeIndex * gapWidth}
          />
        </g>
      </svg>
      <div
        className={css({
          display: "none",
          position: "absolute",
          zIndex: 1,
          inset: 0,
          background: `
            linear-gradient(
              90deg,
              #FFEB81 0%,
              #BEEC86 26%,
              #63D77D 55%
            )
          `,
        })}
      />
    </div>
  );
}
