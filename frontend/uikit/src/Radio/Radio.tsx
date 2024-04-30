import type { CSSProperties } from "react";

import { a, useTransition } from "@react-spring/web";
import { useEffect, useRef } from "react";
import { css, cx } from "../../styled-system/css";
import { useTheme } from "../Theme/Theme";
import { useRadioGroup } from "./RadioGroup";

export function Radio({
  checked: checkedProp,
  disabled,
  index,
  onChange,
  tabIndex,
}: {
  checked?: boolean;
  disabled?: boolean;
  index?: number;
  onChange?: (checked: boolean) => void;
  tabIndex?: number;
}) {
  const input = useRef<null | HTMLInputElement>(null);
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

  const handleChange = () => {
    if (onChange) {
      onChange(!checked);
    }
  };

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
      dotColor: color(disabled ? "disabledBorder" : "controlSurface"),
      ringColor: color("accent"),
      scale: 0.4, // 8px
    },
    from: {
      dotColor: color(disabled ? "disabledBorder" : "controlSurface"),
      ringColor: color("accent"),
      scale: 0.9, // 18px
    },
    enter: {
      scale: 0.4, // 8px
    },
    leave: {
      dotColor: color(disabled ? "disabledBorder" : "controlSurface"),
      ringColor: color("controlBorder"),
      scale: 0.9, // 18px
    },
  });

  return (
    <div
      onClick={handleClick}
      className={css({
        position: "relative",
        display: "inline-block",
        width: 20,
        height: 20,
      })}
    >
      <input
        ref={input}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={radioGroup?.onKeyDown}
        tabIndex={tabIndex ?? (
          radioGroup && (
              radioGroup.focusableIndex === undefined
              || index === radioGroup.focusableIndex
            )
            ? 0
            : -1
        )}
        type="radio"
        className={cx(
          "peer",
          css({
            zIndex: 1,
            position: "absolute",
            inset: 0,
            opacity: 0,
            pointerEvents: "none",
          }),
        )}
      />
      <div
        className={css({
          position: "absolute",
          inset: 0,
          background: "controlSurface",
          border: "1px solid token(colors.controlBorder)",
          borderRadius: "50%",
          _peerActive: {
            borderColor: "accentActive",
          },
          _peerDisabled: {
            background: "disabledSurface",
            borderColor: "disabledBorder!",
          },
        })}
      />
      <div
        // focus ring
        className={css({
          display: "none",
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: "background",
          borderRadius: "50%",
          outline: "2px solid token(colors.focused)",
          outlineOffset: 3,
          _peerFocusVisible: {
            display: "block",
          },
        })}
      />
      {checkTransition((style, checked) => (
        checked && (
          <a.div
            className={css({
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "var(--ringColor)",
              _peerActive: {
                background: "accentActive",
                "& > div": {
                  transform: "scale(0.9)",
                },
              },
              _peerDisabled: {
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
                  borderRadius: "50%",
                })}
                style={{
                  background: style.dotColor,
                  scale: style.scale,
                }}
              />
            </div>
          </a.div>
        )
      ))}
    </div>
  );
}
