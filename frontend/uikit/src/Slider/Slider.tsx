"use client";

import type { SpringValue } from "@react-spring/web";
import type { CSSProperties } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import type { Direction } from "../types";

import { a, useSpring, useSprings } from "@react-spring/web";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { token } from "../../styled-system/tokens";

type GradientMode = "low-to-high" | "high-to-low";
type Chart = number[];

const PADDING = 4;
const BAR_HEIGHT = 4;
const HANDLE_OUTLINE = 2;
const HANDLE_SIZE = 26; // with the outline
const MIN_WIDTH = HANDLE_SIZE * 10;
const CHART_MAX_HEIGHT = 17;
const HEIGHT = Math.max(HANDLE_SIZE, BAR_HEIGHT, CHART_MAX_HEIGHT * 2) + PADDING * 2;
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

  const moveSpring = useSpring({
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
    to: {
      activeBarTransform: `scaleX(${value})`,
      handleTransform: `translate3d(${value * 100}%, 0, 0)`,
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

  const gradientColors = useMemo(() => getGradientColors(gradientMode), [gradientMode]);

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
                activeBarTransform={moveSpring.activeBarTransform}
                chart={chart}
                gradient={gradient}
                gradientMode={gradientMode}
                value={value}
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
                    transform: moveSpring.activeBarTransform,
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
              transform: moveSpring.handleTransform,
            }}
          >
            <div
              className={css({
                position: "absolute",
                top: "50%",
                left: 0,
                transform: "translateY(-50%)",
                borderWidth: HANDLE_OUTLINE,
                borderStyle: "solid",
                borderRadius: "50%",
                pointerEvents: "auto",
                "--borderColor": "token(colors.controlBorderStrong)",
                "--borderColorDisabled": "token(colors.disabledBorder)",
                "--backgroundColor": "token(colors.controlSurface)",
                "--backgroundColorDisabled": "token(colors.disabledSurface)",
              })}
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                translate: pressed ? "0 1px" : "0 0",
                background: `var(${disabled ? "--backgroundColorDisabled" : "--backgroundColor"})`,
                borderColor: `var(${disabled ? "--borderColorDisabled" : "--borderColor"})`,
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
    activeBarTransform,
    chart,
    gradient,
    gradientMode,
    value,
  }: {
    activeBarTransform: SpringValue<string>;
    chart: Chart;
    gradient?: [number, number];
    gradientMode: GradientMode;
    value: number;
  }) {
    const chartSprings = useSprings(
      chart.length,
      chart.map((_, index) => {
        const show = index / chart.length <= value;
        return {
          config: { mass: 2, tension: 1000, friction: 100 },
          to: { transform: show ? `scaleY(1)` : `scaleY(0)` },
          immediate: !show,
        };
      }),
    );

    const gradientStops = useMemo(() => {
      if (!gradient) return null;

      const [step2, step3] = gradient;
      const blur = GRADIENT_TRANSITION_BLUR / 100 / 2;

      const gradientColors = getGradientColors(gradientMode);

      return [
        { offset: "0%", color: gradientColors[0] },
        { offset: `${(step2 - blur) * 100}%`, color: gradientColors[1] },
        { offset: `${(step2 + blur) * 100}%`, color: gradientColors[2] },
        { offset: `${(step3 - blur) * 100}%`, color: gradientColors[3] },
        { offset: `${(step3 + blur) * 100}%`, color: gradientColors[4] },
        { offset: "100%", color: gradientColors[4] },
      ];
    }, [gradient, gradientMode]);

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
          {gradientStops && (
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientStops.map((stop, index) => (
                <stop
                  key={index}
                  offset={stop.offset}
                  stopColor={stop.color}
                />
              ))}
            </linearGradient>
          )}
          <mask id="barMask">
            {chartSprings.map((styles, index) => {
              const barValue = chart[index];
              const barWidth = 100 / chart.length;
              const x = index * barWidth;
              const y = CHART_MAX_HEIGHT * (1 - barValue);
              const height = barValue * CHART_MAX_HEIGHT;
              return (
                <a.rect
                  key={index}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill="white"
                  style={{
                    transformOrigin: `${x}px ${CHART_MAX_HEIGHT}px`,
                    transform: styles.transform,
                  }}
                />
              );
            })}
          </mask>
        </defs>

        {chart.map((barValue, index) => {
          const barWidth = 100 / chart.length;
          const x = index * barWidth;
          const y = CHART_MAX_HEIGHT * (1 - barValue);
          const height = barValue * CHART_MAX_HEIGHT;
          return (
            <a.rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              fill="#DDE0E8"
            />
          );
        })}

        <rect
          x="0"
          y="0"
          width="100"
          height={CHART_MAX_HEIGHT * 2}
          fill={gradientStops ? "url(#barGradient)" : "var(--colors-warning)"}
          mask="url(#barMask)"
        />

        <a.rect
          x="0"
          y={CHART_MAX_HEIGHT - 1}
          width="100"
          height="1"
          fill="currentColor"
          style={{
            transform: activeBarTransform,
            transformOrigin: "0 0",
          }}
        />
      </svg>
    );
  },
  (prev, next) => (
    prev.value === next.value
    && prev.gradientMode === next.gradientMode
    && JSON.stringify(prev.chart) === JSON.stringify(next.chart)
    && JSON.stringify(prev.gradient) === JSON.stringify(next.gradient)
  ),
);

function isTouchEvent(
  event: ReactTouchEvent | ReactMouseEvent | TouchEvent | MouseEvent,
): event is TouchEvent | ReactTouchEvent {
  return "touches" in event;
}

function getGradientColors(gradientMode: GradientMode) {
  const colors = [
    token("colors.riskGradient1"),
    token("colors.riskGradient2"),
    token("colors.riskGradient3"),
    token("colors.riskGradient4"),
    token("colors.riskGradient5"),
  ];
  return gradientMode === "low-to-high"
    ? colors
    : colors.slice().reverse();
}
