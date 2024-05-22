import type { CSSProperties } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import type { Direction } from "../types";

import { a, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";

const BAR_HEIGHT = 4;
const HANDLE_OUTLINE = 2;
const HANDLE_SIZE = 26 + HANDLE_OUTLINE * 2;
const PADDING = 5;
const MIN_WIDTH = HANDLE_SIZE * 10;
const HEIGHT = Math.max(HANDLE_SIZE, BAR_HEIGHT) + PADDING * 2;

export function Slider({
  disabled,
  gradientMode,
  keyboardStep = (value, dir) => Math.round((value + 0.1 * dir) * 10) / 10,
  onChange,
  value,
}: {
  disabled?: boolean;
  gradientMode?: boolean;
  keyboardStep?: (value: number, direction: Direction) => number;
  onChange: (value: number) => void;
  value: number;
}) {
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
      updateValueFromClientX(clientXFromEvent(event));
    };

    const dragStop = () => {
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
    activeBarTransform: `scaleX(${value})`,
    handleTransform: `translate3d(${value * 100}%, 0, 0)`,
    value: Math.max(0, Math.min(1, value)),
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
        "--focusRingWidth": focused ? "2px" : "0",
      } as CSSProperties}
    >
      <div
        ref={handleRef}
        onMouseDown={dragStart}
        onTouchStart={dragStart}
        className={css({
          position: "relative",
          cursor: "pointer",
        })}
        style={{
          height: HEIGHT,
        }}
      >
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
                "--backgroundNormal": "token(colors.controlSurfaceAlt)",
                "--backgroundGradient": `linear-gradient(
                  90deg,
                  token(colors.positive) 0%,
                  token(colors.warning) 50%,
                  token(colors.negative) 100%
                )`,
                "--backgroundDisabled": "token(colors.disabledBorder)",
              })}
              style={{
                background: `var(${
                  disabled
                    ? "--backgroundDisabled"
                    : gradientMode
                    ? "--backgroundGradient"
                    : "--backgroundNormal"
                })`,
              }}
            />
            <a.div
              className={css({
                position: "absolute",
                inset: 0,
                transformOrigin: "0 0",
                "--backgroundNormal": "token(colors.accent)",
                "--backgroundPressed": "token(colors.accentActive)",
              })}
              style={{
                display: gradientMode || disabled ? "none" : "block",
                transform: moveSpring.activeBarTransform,
                background: `var(${disabled ? "--backgroundPressed" : "--backgroundNormal"})`,
              }}
            />
          </div>
        </div>

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
                transform: "translateY(-50%)",
                borderWidth: 2,
                borderStyle: "solid",
                borderRadius: "50%",
                cursor: "pointer",
                pointerEvents: "auto",
                "--borderColor": "token(colors.controlBorderStrong)",
                "--borderColorDisabled": "token(colors.disabledBorder)",
                "--backgroundColor": "token(colors.controlSurface)",
                "--backgroundColorDisabled": "token(colors.disabledSurface)",
              })}
              style={{
                left: HANDLE_OUTLINE,
                width: HANDLE_SIZE - HANDLE_OUTLINE * 2,
                height: HANDLE_SIZE - HANDLE_OUTLINE * 2,
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

function isTouchEvent(
  event: ReactTouchEvent | ReactMouseEvent | TouchEvent | MouseEvent,
): event is TouchEvent | ReactTouchEvent {
  return "touches" in event;
}
