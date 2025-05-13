"use client";

import type { SpringValue } from "@react-spring/web";
import type { CSSProperties } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import type { Direction } from "../types";

import { a, useSpring } from "@react-spring/web";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { token } from "../../styled-system/tokens";

type GradientMode = "low-to-high" | "high-to-low";
type Chart = number[];

const BAR_HEIGHT = 4; // in non-chart mode
const HANDLE_OUTLINE = 2;
const HANDLE_SIZE = 26; // with the outline
const MIN_WIDTH = HANDLE_SIZE * 2;
const CHART_MAX_HEIGHT = 30;
const HEIGHT = 60;
const GRADIENT_TRANSITION_BLUR = 4;

export function Slider({
  chart,
  disabled,
  gradient,
  gradientMode = "low-to-high",
  keyboardStep,
  onChange,
  onDragEnd,
  onDragStart,
  value,
}: {
  disabled?: boolean;
  gradient?: [number, number];
  gradientMode?: GradientMode;
  chart?: Chart;
  keyboardStep?: (value: number, direction: Direction) => number;
  onChange: (value: number) => void;
  onDragEnd?: () => void;
  onDragStart?: () => void;
  value: number;
}) {
  keyboardStep ??= chart
    ? (value, dir) => (value * chart.length + dir) * 1 / chart.length
    : (value, dir) => Math.round((value + 0.1 * dir) * 10) / 10;

  value = Math.max(0, Math.min(1, value));

  const [pressed, setPressed] = useState(false);

  const lastRect = useRef<DOMRect | null>(null);
  const lastRectTime = useRef(-1);
  const mainElement = useRef<HTMLElement | null>(null);
  const document = useRef<Document | null>(null);

  const getRect = useCallback(() => {
    const now = Date.now();

    // Cache the rect if the last poll was less than a second ago
    if (lastRect.current && now - lastRectTime.current < 1000) {
      return lastRect.current;
    }

    lastRectTime.current = now;
    lastRect.current = mainElement.current?.getBoundingClientRect()
      ?? new window.DOMRect();

    return lastRect.current;
  }, []);

  const clientXFromEvent = (
    event: ReactTouchEvent | ReactMouseEvent | TouchEvent | MouseEvent,
  ) => {
    if (isTouchEvent(event)) {
      return event.touches.item(0)?.clientX ?? 0;
    }
    return event.clientX;
  };

  const updateValueFromClientX = useCallback(
    (clientX: number) => {
      const rect = getRect();
      const x = Math.min(rect.width, Math.max(0, clientX - rect.x));
      onChange(x / rect.width);
    },
    [onChange, getRect],
  );

  const dragStart = (event: ReactMouseEvent | ReactTouchEvent) => {
    if (!disabled) {
      setPressed(true);
      updateValueFromClientX(clientXFromEvent(event));
    }
  };

  const handleRef = (element: HTMLDivElement) => {
    mainElement.current = element;
    document.current = element && element.ownerDocument;
  };

  useEffect(() => {
    const doc = document.current;
    if (!doc || !pressed) return;

    const dragMove = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      onDragStart?.();
      updateValueFromClientX(clientXFromEvent(event));
    };

    const dragStop = () => {
      onDragEnd?.();
      setPressed(false);
    };

    doc.addEventListener("mouseup", dragStop);
    doc.addEventListener("touchend", dragStop);
    doc.addEventListener("mousemove", dragMove);
    doc.addEventListener("touchmove", dragMove);

    return () => {
      doc.removeEventListener("mouseup", dragStop);
      doc.removeEventListener("touchend", dragStop);
      doc.removeEventListener("mousemove", dragMove);
      doc.removeEventListener("touchmove", dragMove);
    };
  }, [pressed, updateValueFromClientX]);

  const gradientColors = useMemo(() => getGradientColors(gradientMode), [gradientMode]);

  const moveSpring = useSpring({
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
      precision: 0.001,
    },
    to: {
      value,
      handleColor: gradient && chart
        ? value <= gradient[0]
          ? gradientColors[0]
          : value <= gradient[1]
          ? gradientColors[2]
          : gradientColors[4]
        : token("colors.controlSurface"),
    },
  });

  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const doc = document.current;
    if (!doc || !focused) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (disabled) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(Math.max(0, keyboardStep(value, -1)));
      }
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        onChange(Math.min(1, keyboardStep(value, 1)));
      }
    };

    doc.addEventListener("keydown", onKeyDown);
    return () => {
      doc.removeEventListener("keydown", onKeyDown);
    };
  }, [focused, keyboardStep, onChange, value, disabled]);

  return (
    <div
      tabIndex={disabled ? -1 : 0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={css({
        position: "relative",
        userSelect: "none",
        borderRadius: 4,
        outlineOffset: 2,
        _focusVisible: {
          outline: `var(--focusRingWidth) solid token(colors.focused)`,
        },
      })}
      style={{
        minWidth: `${MIN_WIDTH}px`,
        width: "100%",
        "--focusRingWidth": focused ? "2px" : "0",
      } as CSSProperties}
    >
      <div
        ref={handleRef}
        onMouseDown={dragStart}
        onTouchStart={dragStart}
        className={css({
          position: "relative",
        })}
        style={{
          height: HEIGHT,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {chart
          ? (
            <div
              className={css({
                position: "absolute",
                inset: "0 0 50%",
              })}
            >
              <ChartSvg
                chart={chart}
                gradient={gradient}
                gradientMode={gradientMode}
                value={moveSpring.value}
              />
            </div>
          )
          : (
            <div
              className={css({
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
              })}
              style={{
                height: BAR_HEIGHT,
              }}
            >
              <div
                className={css({
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                })}
                style={{
                  borderRadius: BAR_HEIGHT / 2,
                }}
              >
                <div
                  className={css({
                    position: "absolute",
                    inset: 0,
                    "--bgNormal": "token(colors.controlSurfaceAlt)",
                    "--bgDisabled": "token(colors.disabledBorder)",
                    "--gradient": `linear-gradient(
                      to right,
                      var(--gradientColor1) 0%,
                      var(--gradientColor2) calc(var(--gradientStep2) - var(--gradientTransitionBlur) / 2),
                      var(--gradientColor3) calc(var(--gradientStep2) + var(--gradientTransitionBlur) / 2),
                      var(--gradientColor4) calc(var(--gradientStep3) - var(--gradientTransitionBlur) / 2),
                      var(--gradientColor5) calc(var(--gradientStep3) + var(--gradientTransitionBlur) / 2),
                      var(--gradientColor5) 100%
                    )`,
                  })}
                  style={{
                    background: `var(${
                      disabled
                        ? "--bgDisabled"
                        : gradient !== undefined
                        ? "--gradient"
                        : "--bgNormal"
                    })`,
                    "--gradientTransitionBlur": `${GRADIENT_TRANSITION_BLUR}%`,
                    "--gradientStep2": `${(gradient?.[0] ?? 0.5) * 100}%`,
                    "--gradientStep3": `${(gradient?.[1] ?? 0.5) * 100}%`,
                    "--gradientColor1": gradientColors[0],
                    "--gradientColor2": gradientColors[1],
                    "--gradientColor3": gradientColors[2],
                    "--gradientColor4": gradientColors[3],
                    "--gradientColor5": gradientColors[4],
                  } as CSSProperties}
                />
                <a.div
                  className={css({
                    position: "absolute",
                    inset: 0,
                    transformOrigin: "0 0",
                    "--bgNormal": "token(colors.accent)",
                    "--bgPressed": "token(colors.accentActive)",
                  })}
                  style={{
                    display: gradient || disabled ? "none" : "block",
                    transform: moveSpring.value.to((value) => `scale(${value}, 1)`),
                    background: `var(${disabled ? "--bgPressed" : "--bgNormal"})`,
                  }}
                />
              </div>
            </div>
          )}

        <div
          className={css({
            overflow: "hidden",
            pointerEvents: "none",
            height: "100%",
            transformOrigin: "50% 50%",
          })}
          style={{
            width: `calc(100% + ${HANDLE_SIZE}px)`,
            transform: `translate(-${HANDLE_SIZE / 2}px, 0)`,
          }}
        >
          <a.div
            className={css({
              height: "100%",
              transformOrigin: "50% 50%",
            })}
            style={{
              width: `calc(100% - ${HANDLE_SIZE}px)`,
              transform: moveSpring.value.to((value) => `translate(${value * 100}%, 0)`),
            }}
          >
            <a.div
              className={css({
                position: "absolute",
                top: "50%",
                left: 0,
                borderWidth: HANDLE_OUTLINE,
                borderStyle: "solid",
                borderRadius: "50%",
                pointerEvents: "auto",

                background: "controlSurface",
                borderColor: "controlBorderStrong",

                "--borderColor": "token(colors.controlBorderStrong)",
                "--borderColorDisabled": "token(colors.disabledBorder)",

                "--backgroundColor": "token(colors.controlSurface)",
                "--backgroundColorDisabled": "token(colors.disabledSurface)",
              })}
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: disabled ? `var(--backgroundColorDisabled)` : moveSpring.handleColor,
                borderColor: `var(--borderColor${disabled ? "Disabled" : ""})`,
                transform: `
                  translateY(-50%)
                  translateY(${pressed ? "1px" : "0"})
                `,
              }}
            />
          </a.div>
        </div>
      </div>
    </div>
  );
}

const ChartSvg = memo(
  function ChartSvg({
    chart,
    gradient,
    gradientMode,
    value,
  }: {
    chart: Chart;
    gradient?: [number, number];
    gradientMode: GradientMode;
    value: SpringValue<number>;
  }) {
    const id = useId();

    const gradientColors = useMemo(() => (
      getGradientColors(gradientMode, 3)
    ), [gradientMode]);

    const gradientGeometry = useMemo(() => {
      if (!gradient) {
        return null;
      }
      const steps = [0, ...gradient];
      return steps.map((step, index) => {
        const next = index === steps.length - 1 ? 1 : steps[index + 1];
        return { x: step * 100, width: (next - step) * 100, index };
      });
    }, [gradient]);

    return (
      <svg
        className={css({
          position: "absolute",
          inset: "auto 0 0",
          width: "100%",
          height: CHART_MAX_HEIGHT,
        })}
        viewBox={`0 0 100 ${CHART_MAX_HEIGHT}`}
        preserveAspectRatio="none"
        shapeRendering="optimizeSpeed"
      >
        <defs>
          {[
            token("colors.riskGradientDimmed1"),
            token("colors.riskGradientDimmed2"),
            token("colors.riskGradientDimmed3"),
          ].map((color, index) => (
            <linearGradient
              key={index}
              id={`${id}-gradient-${index + 1}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={color} stopOpacity="0" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          ))}

          <clipPath id={`${id}-bars`}>
            <path
              // clip path using the shape of the bars (used to clip the colors)
              d={chart.map((barValue, index) => {
                const barWidth = 100 / chart.length;
                const x = index * barWidth;
                const y = CHART_MAX_HEIGHT * (1 - barValue);
                const height = barValue * CHART_MAX_HEIGHT;
                return `M${x},${y} h${barWidth} v${height} h-${barWidth} z`;
              }).join(" ")}
              fill="white"
            />
          </clipPath>

          <clipPath id={`${id}-reveal`}>
            <a.rect
              // rectangle used to clip the bars
              x="0"
              y="0"
              width="100"
              height={CHART_MAX_HEIGHT}
              fill="white"
              style={{
                transform: value.to((value) => `scale(${value}, 1)`),
                transformOrigin: "0 0",
              }}
            />
          </clipPath>
        </defs>

        {gradientGeometry?.map(({ x, width, index }) => (
          <rect
            // gradients used as background
            key={index}
            x={`${x}%`}
            y="0"
            height={CHART_MAX_HEIGHT}
            width={`${width}%`}
            fill={`url(#${id}-gradient-${index + 1})`}
            clipPath={`url(#${id}-reveal)`}
          />
        ))}

        <g
          // this group gets clipped by the bars
          clipPath={`url(#${id}-bars)`}
        >
          <rect
            // base color
            x="0"
            y="0"
            width="100"
            height={CHART_MAX_HEIGHT}
            fill="#B1B7C8"
          />

          <g
            // this group gets revealed by the slider
            clipPath={`url(#${id}-reveal)`}
          >
            {gradientGeometry?.map(({ x, width, index }) => (
              // gradient colors
              <rect
                key={index}
                x={`${x}%`}
                y="0"
                height={CHART_MAX_HEIGHT}
                width={`${width}%`}
                fill={gradientColors[index]}
              />
            )) ?? (
              <rect
                // normal color
                x="0"
                y="0"
                width="100"
                height={CHART_MAX_HEIGHT}
                fill="var(--colors-warning)"
              />
            )}
          </g>
        </g>

        <rect
          // base line
          x="0"
          y={CHART_MAX_HEIGHT - 2}
          width="100"
          height="2"
          fill="#B1B7C8"
        />

        <a.rect
          // active line
          x="0"
          y={CHART_MAX_HEIGHT - 2}
          width="100"
          height="2"
          fill="currentColor"
          style={{
            transform: value.to((value) => `scale(${value}, 1)`),
            transformOrigin: "0 0",
          }}
        />
      </svg>
    );
  },
  (prev, next) => (
    prev.gradientMode === next.gradientMode
    && JSON.stringify(prev.chart) === JSON.stringify(next.chart)
    && JSON.stringify(prev.gradient) === JSON.stringify(next.gradient)
  ),
);

function isTouchEvent(
  event: ReactTouchEvent | ReactMouseEvent | TouchEvent | MouseEvent,
): event is TouchEvent | ReactTouchEvent {
  return "touches" in event;
}

const gradient = [
  token("colors.riskGradient1"),
  token("colors.riskGradient2"),
  token("colors.riskGradient3"),
  token("colors.riskGradient4"),
  token("colors.riskGradient5"),
];

function getGradientColors(gradientMode: GradientMode, totalColors: 3 | 5 = 5) {
  const colors = totalColors === 3
    ? [gradient[0], gradient[2], gradient[4]]
    : gradient;
  return gradientMode === "low-to-high" ? colors : colors.slice().reverse();
}
