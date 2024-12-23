"use client";

import type { CSSProperties } from "react";

import { a, useTransition } from "@react-spring/web";
import { useEffect, useRef } from "react";
import { css, cx } from "../../styled-system/css";
import { useTheme } from "../Theme/Theme";
import { useRadioGroup } from "./RadioGroup";

export function Radio({
  appearance = "radio",
  checked: checkedProp,
  disabled,
  id,
  index,
  onChange,
  tabIndex,
}: {
  appearance?: "radio" | "checkbox";
  checked?: boolean;
  disabled?: boolean;
  id?: string;
  index?: number;
  onChange?: (checked: boolean) => void;
  tabIndex?: number;
}) {
  const input = useRef<null | HTMLButtonElement>(null);
  const radioGroup = useRadioGroup(index);
  const inRadioGroup = radioGroup !== null;
  const checked = checkedProp ?? (inRadioGroup && index === radioGroup.selected);
  const { color } = useTheme();

  if (!onChange) {
    if (!inRadioGroup || index === undefined) {
      throw new Error(
        "Radio requires an onChange handler or to be in a RadioGroup with the index prop being set.",
      );
    }
    onChange = (checked) => {
      if (checked) radioGroup.select(index);
    };
  }

  const handleClick = () => {
    if (onChange && !disabled) {
      onChange(!checked);
    }
  };

  const firstRender = useRef(true);
  useEffect(() => {
    if (checked && inRadioGroup && !firstRender.current) {
      input.current?.focus();
    }
    firstRender.current = false;
  }, [checked, inRadioGroup]);

  const checkTransition = useTransition(checked, {
    config: {
      mass: 1,
      tension: 2400,
      friction: 100,
    },
    initial: {
      tickColor: color(disabled ? "disabledBorder" : "controlSurface"),
      ringColor: color("accent"),
      tickProgress: 0,
    },
    from: {
      tickColor: color(disabled ? "disabledBorder" : "controlSurface"),
      ringColor: color("accent"),
      tickProgress: 1,
    },
    enter: {
      tickProgress: 0,
    },
    leave: {
      tickColor: color(disabled ? "disabledBorder" : "controlSurface"),
      ringColor: color("controlBorder"),
      tickProgress: 1,
    },
  });

  return (
    <button
      ref={input}
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={radioGroup?.onKeyDown}
      tabIndex={tabIndex ?? (
        radioGroup && (
            radioGroup.focusableIndex === undefined
            || index === radioGroup.focusableIndex
          )
          ? 0
          : -1
      )}
      className={cx(
        "group",
        css({
          position: "relative",
          display: "inline-block",
          width: 20,
          height: 20,
          outline: 0,
          cursor: "pointer",
        }),
      )}
    >
      <div
        className={css({
          position: "absolute",
          inset: 0,
          background: "controlSurface",
          border: "1px solid token(colors.controlBorder)",
          _groupActive: {
            borderColor: "accentActive",
          },
          _groupDisabled: {
            background: "disabledSurface",
            borderColor: "disabledBorder!",
          },
        })}
        style={{
          borderRadius: appearance === "radio" ? "50%" : 4,
        }}
      />
      <div
        // focus ring
        className={css({
          display: "none",
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: "background",
          outline: "2px solid token(colors.focused)",
          _groupFocusVisible: {
            display: "block",
          },
        })}
        style={{
          borderRadius: appearance === "radio" ? "50%" : 4,
          outlineOffset: appearance === "radio" ? 3 : 2,
        }}
      />
      {checkTransition((style, checked) => (
        checked && (
          appearance === "radio"
            ? (
              <a.div
                className={css({
                  position: "absolute",
                  inset: 0,
                  background: "var(--ringColor)",
                  borderRadius: "50%",
                  _groupActive: {
                    background: "accentActive",
                    "& > div": {
                      transform: "scale(0.9)",
                    },
                  },
                  _groupDisabled: {
                    background: "disabledSurface!",
                    border: "1px solid token(colors.disabledBorder)!",
                    "& > div": {
                      transform: "scale(1)!",
                    },
                  },
                })}
                style={{
                  "--ringColor": style.ringColor,
                } as CSSProperties}
              >
                <div
                  className={css({
                    position: "absolute",
                    inset: 0,
                  })}
                >
                  <a.div
                    className={css({
                      position: "absolute",
                      inset: 0,
                    })}
                    style={{
                      background: style.tickColor,
                      scale: style.tickProgress.to([0, 1], [
                        0.4, // 8px
                        0.9, // 18px
                      ]),
                      borderRadius: "50%",
                    }}
                  />
                </div>
              </a.div>
            )
            : (
              <a.div
                className={css({
                  position: "absolute",
                  inset: 0,
                  background: "var(--ringColor)",
                  borderRadius: 4,
                  _groupActive: {
                    background: "accentActive",
                    "& > div": {
                      transform: "scale(0.9)",
                    },
                  },
                  _groupDisabled: {
                    background: "disabledSurface!",
                    border: "1px solid token(colors.disabledBorder)!",
                    "& > div": {
                      transform: "scale(1)!",
                    },
                  },
                })}
                style={{
                  ...({
                    "--ringColor": style.ringColor,
                  } as CSSProperties),

                  opacity: style.tickProgress.to([0, 1], [1, 0]),
                }}
              >
                <div
                  className={css({
                    position: "absolute",
                    inset: 0,
                  })}
                >
                  <a.div
                    className={css({
                      position: "absolute",
                      inset: 0,
                    })}
                    style={{
                      color: style.tickColor,
                      opacity: style.tickProgress.to([0, 1], [1, 0]),
                      scale: style.tickProgress.to([0, 1], [1, 0]),
                    }}
                  >
                    <Tick />
                  </a.div>
                </div>
              </a.div>
            )
        )
      ))}
    </button>
  );
}

function Tick() {
  return (
    <svg width="20" height="20" fill="none">
      <path
        clipRule="evenodd"
        fill="currentColor"
        fillRule="evenodd"
        d="m15.41 5.563-6.886 10.1-4.183-3.66 1.317-1.505 2.485 2.173 5.614-8.234 1.652 1.126Z"
      />
    </svg>
  );
}
