import type { ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { useState } from "react";
import { forwardRef, useId, useRef } from "react";
import { css, cx } from "../../styled-system/css";
import { IconCross } from "../icons";
import { useElementSize } from "../react-utils";

const diffSpringConfig = {
  mass: 1,
  tension: 3000,
  friction: 120,
};

const InputField = forwardRef<HTMLInputElement, {
  contextual?: ReactNode;
  difference?: ReactNode;
  disabled?: boolean;
  label?:
    | ReactNode
    | { end: ReactNode; start?: ReactNode }
    | { end?: ReactNode; start: ReactNode };
  labelHeight?: number;
  labelSpacing?: number;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onDifferenceClick?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  secondary?:
    | ReactNode
    | { end: ReactNode; start?: ReactNode }
    | { end?: ReactNode; start: ReactNode };
  secondaryHeight?: number;
  secondarySpacing?: number;
  value?: string;
  valueUnfocused?: ReactNode;
}>(function InputField({
  contextual,
  difference,
  disabled = false,
  label,
  labelHeight = 12,
  labelSpacing = 12,
  onBlur,
  onChange,
  onDifferenceClick,
  onFocus,
  placeholder,
  secondary,
  secondaryHeight = 12,
  secondarySpacing = 20,
  value,
  valueUnfocused,
}, ref) {
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

  const id = useId();

  const valueMeasurement = useRef<HTMLDivElement>(null);

  const [differenceSpring, differenceSpringApi] = useSpring(() => ({
    initial: {
      transform: `translate3d(0px, 0, 0) scale3d(1,1,1)`,
      opacity: 0,
    },
    config: diffSpringConfig,
  }));

  const differenceLeftBeforeHiding = useRef<number | null>(null);

  useElementSize(valueMeasurement, ({ inlineSize }) => {
    const diffLeft = inlineSize + 26;

    // hide
    if (!difference) {
      differenceSpringApi.start({
        transform: `
          translate3d(${(differenceLeftBeforeHiding.current ?? diffLeft)}px, 0, 0)
          scale3d(1.1, 1.1, 1)
        `,
        opacity: 0,
        immediate: true,
      });
      return;
    }

    // prepare before first show
    if (differenceLeftBeforeHiding.current === null) {
      differenceSpringApi.start({
        transform: `
          translate3d(${diffLeft}px, 0, 0)
          scale3d(1.1, 1.1, 1)
        `,
        immediate: true,
      });
    }

    // show
    differenceSpringApi.start({
      transform: `
        translate3d(${diffLeft}px, 0, 0)
        scale3d(1, 1, 1)
      `,
      opacity: 1,
      config: diffSpringConfig,
    });
    differenceLeftBeforeHiding.current = diffLeft;
  });

  const showValueUnfocused = valueUnfocused && !focused;

  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        background: "fieldSurface",
        border: "1px solid token(colors.fieldBorder)",
        borderRadius: 8,
        padding: 16,
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 16,
          fontWeight: 500,
          color: "contentAlt",
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
        ref={valueMeasurement}
        className={css({
          position: "absolute",
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: -1,
          whiteSpace: "nowrap",
          visibility: "hidden",
          pointerEvents: "none",
        })}
      >
        {value}
      </div>
      {difference && (
        <a.button
          onClick={onDifferenceClick}
          className={css({
            position: "absolute",
            top: (136 - 2) / 2 - 10,
            left: 0,
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "center",
            height: 20,
            padding: "0 8px",
            whiteSpace: "nowrap",
            background: "strongSurface",
            color: "strongSurfaceContent",
            cursor: "pointer",
            borderRadius: 10,
            outline: 0,
            _active: {
              translate: "0 1px",
            },
            _focusVisible: {
              outline: "2px solid token(colors.focused)",
            },
          })}
          style={{
            ...differenceSpring,
            pointerEvents: difference ? "auto" : "none",
          }}
        >
          {difference}
          <IconCross size={12} />
        </a.button>
      )}
      <div
        className={css({
          position: "relative",
          zIndex: 1,
          display: "flex",
          height: 40,
        })}
      >
        <input
          ref={ref}
          id={id}
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
              position: "absolute",
              zIndex: 2,
              inset: `50% 0 auto auto`,
              transform: "translateY(-50%)",
            })}
          >
            {contextual}
          </div>
        )}
      </div>
      {(secondary_.start || secondary_.end) && (
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
            paddingTop: secondarySpacing,
          }}
        >
          {secondary_.start
            ? (
              <div
                className={css({
                  flexGrow: 0,
                  flexShrink: 1,
                  display: "flex",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  maxWidth: "50%",
                })}
              >
                {secondary_.start}
              </div>
            )
            : <div />}
          {secondary_.end && (
            <div
              className={css({
                flexGrow: 0,
                flexShrink: 1,
                display: "flex",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
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
  );
});

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
