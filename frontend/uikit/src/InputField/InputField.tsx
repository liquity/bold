import type { ReactNode } from "react";

import { useId } from "react";
import { css, cx } from "../../styled-system/css";

export function InputField({
  action,
  label,
  onBlur,
  onChange,
  onFocus,
  placeholder,
  secondaryEnd,
  secondaryStart,
  value,
}: {
  action?: ReactNode;
  label?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  secondaryEnd?: ReactNode;
  secondaryStart?: ReactNode;
  value?: string;
}) {
  const id = useId();
  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        paddingBottom: 8,
        background: "fieldSurface",
        border: "1px solid token(colors.fieldBorder)",
        borderRadius: 8,
      })}
    >
      {label && (
        <label
          htmlFor={id}
          className={css({
            position: "absolute",
            inset: "0 auto auto 0",
            padding: "8px 16px 0",
            fontSize: 16,
            fontWeight: 500,
            color: "contentAlt",
          })}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onBlur={onBlur}
        onChange={(event) => {
          onChange?.(event.target.value);
        }}
        onFocus={onFocus}
        className={cx(
          "peer",
          css({
            display: "block",
            height: 120,
            padding: "0 16px",
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
      <div
        className={css({
          display: "none",
          position: "absolute",
          inset: -1,
          border: "2px solid token(colors.focused)",
          borderRadius: 8,
          pointerEvents: "none",
          _peerFocusVisible: {
            display: "block",
          },
        })}
      />
      {action && (
        <div
          className={css({
            position: "absolute",
            inset: "40px 16px auto auto",
          })}
        >
          {action}
        </div>
      )}
      <div
        className={css({
          position: "absolute",
          inset: "auto 16px 8px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        <div>
          {secondaryStart}
        </div>
        <div>
          {secondaryEnd}
        </div>
      </div>
    </div>
  );
}
