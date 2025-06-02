"use client";

import type { ReactNode, Ref } from "react";

import { a, useSpring, useTransition } from "@react-spring/web";
import { useEffect, useId, useState } from "react";
import { css, cx } from "../../styled-system/css";

const diffSpringConfig = {
  mass: 1,
  tension: 3000,
  friction: 120,
};

type Drawer = {
  mode: "error" | "loading" | "success" | "warning";
  message: ReactNode;
  autoClose?: number;
};

function InputField({
  contextual,
  disabled = false,
  drawer,
  id: idFromProps,
  onDrawerClose,
  label,
  labelHeight = 12,
  labelSpacing = 12,
  onBlur,
  onChange,
  onFocus,
  placeholder,
  ref,
  secondary,
  secondaryHeight = 24,
  secondarySpacing = 14,
  value,
  valueUnfocused,
}: {
  contextual?: ReactNode;
  disabled?: boolean;
  drawer?: null | Drawer;
  id?: string;
  onDrawerClose?: () => void;
  label?:
    | ReactNode
    | { end: ReactNode; start?: ReactNode }
    | { end?: ReactNode; start: ReactNode };
  labelHeight?: number;
  labelSpacing?: number;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
  secondary?:
    | ReactNode
    | { end: ReactNode; start?: ReactNode }
    | { end?: ReactNode; start: ReactNode };
  secondaryHeight?: number;
  secondarySpacing?: number;
  value?: string;
  valueUnfocused?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  const label_ = label
      && typeof label === "object"
      && ("start" in label || "end" in label)
    ? label
    : { start: label };

  const secondary_ = secondary
      && typeof secondary === "object"
      && ("start" in secondary || "end" in secondary)
    ? secondary
    : { start: secondary };

  const autoId = useId();
  const id = idFromProps ?? autoId;

  const showValueUnfocused = valueUnfocused && !focused;

  useEffect(() => {
    if (typeof drawer?.autoClose !== "number" || !onDrawerClose) {
      return;
    }
    const timer = setTimeout(() => {
      onDrawerClose();
    }, drawer.autoClose);
    return () => clearTimeout(timer);
  }, [drawer?.autoClose, drawer?.mode]);

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        width: "100%",
      })}
    >
      <div
        className={css({
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          background: "fieldSurface",
          border: "1px solid token(colors.fieldBorder)",
          borderRadius: 8,
          padding: "16px 16px 10px",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            fontSize: 16,
            fontWeight: 500,
            color: "contentAlt",
            whiteSpace: "nowrap",
          })}
          style={{
            height: labelHeight + labelSpacing,
            paddingBottom: labelSpacing,
          }}
        >
          {label_.start ? <label htmlFor={id}>{label_.start}</label> : <div />}
          {label_.end && <div>{label_.end}</div>}
        </div>
        <div
          className={css({
            position: "relative",
            zIndex: 2,
            display: "flex",
            gap: 16,
            height: 40,
          })}
        >
          <input
            ref={ref}
            id={id}
            name={autoId}
            disabled={disabled}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChange={(event) => {
              onChange?.(event.target.value);
            }}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            placeholder={showValueUnfocused ? "" : placeholder}
            type="text"
            value={showValueUnfocused ? "" : value}
            className={cx(
              "peer",
              css({
                display: "block",
                padding: 0,
                width: "100%",
                height: "100%",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: -1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "content",
                background: "transparent",
                border: 0,
                _placeholder: {
                  color: "dimmed",
                },
                _focusVisible: {
                  outline: 0,
                },
              }),
            )}
          />
          {showValueUnfocused && (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                height: "100%",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: -1,
                color: "content",
                pointerEvents: "none",
              })}
            >
              {valueUnfocused}
            </div>
          )}
          {contextual && (
            <div
              className={css({
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
              })}
            >
              {contextual}
            </div>
          )}
        </div>
        {(secondary_.start || secondary_.end) && (
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: "auto auto",
              gap: 16,
              fontSize: 16,
              fontWeight: 500,
              color: "contentAlt",
              pointerEvents: "none",
              "& > div": {
                pointerEvents: "auto",
              },
            })}
            style={{
              height: secondaryHeight + secondarySpacing,
            }}
          >
            {secondary_.start
              ? (
                <div
                  className={css({
                    display: "flex",
                    alignItems: "flex-end",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  })}
                >
                  <span>
                    {secondary_.start}
                  </span>
                </div>
              )
              : <div />}
            {secondary_.end && (
              <div
                className={css({
                  display: "flex",
                  alignItems: "flex-end",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  justifyContent: "flex-end",
                })}
              >
                {secondary_.end}
              </div>
            )}
          </div>
        )}
        <div
          className={css({
            display: "none",
            position: "absolute",
            inset: -1,
            border: "2px solid token(colors.fieldBorderFocused)",
            borderRadius: 8,
            pointerEvents: "none",
          })}
          style={{
            display: focused ? "block" : "none",
          }}
        />
      </div>
      <Drawer drawer={drawer} />
    </div>
  );
}

function Drawer({
  drawer,
}: {
  drawer?: null | Drawer;
}) {
  const transition = useTransition(drawer, {
    keys: (drawer) => String(Boolean(drawer)),
    from: {
      contentOpacity: 0,
      marginTop: -40,
    },
    enter: {
      contentOpacity: 1,
      marginTop: 0,
    },
    leave: {
      contentOpacity: 0,
      marginTop: -40,
    },
    config: diffSpringConfig,
  });

  const modeSpring = useSpring({
    to: drawer?.mode === "error"
      ? {
        color: "#82301A",
        background: "#FEF5F2",
        border: "#FFE7E1",
      }
      : {
        color: "#2C231E",
        background: "#FAF9F7",
        border: "#EFECE5",
      },
    config: diffSpringConfig,
  });

  return transition(({ marginTop, contentOpacity }, drawer) =>
    drawer && (
      <div
        className={css({
          position: "relative",
          zIndex: 1,
          marginTop: -8,
        })}
      >
        <a.div
          className={css({
            display: "flex",
            alignItems: "center",
            padding: "8px 16px 0",
            height: 48,
            fontSize: 14,
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: "0 0 8px 8px",
          })}
          style={{
            marginTop,
            color: modeSpring.color,
            background: modeSpring.background,
            borderColor: modeSpring.border,
          }}
        >
          <a.div
            style={{
              opacity: contentOpacity.to([0, 0.8, 1], [0, 0, 1]),
            }}
          >
            {drawer.message}
          </a.div>
        </a.div>
      </div>
    )
  );
}

export function InputFieldBadge({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        paddingLeft: icon ? 8 : 16,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      }}
    >
      {icon}
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

const InputFieldCompound = Object.assign(InputField, {
  Badge: InputFieldBadge,
});

export { InputFieldCompound as InputField };
