import type { ReactNode } from "react";

import { useId } from "react";
import { css, cx } from "../../styled-system/css";

export function InputField({
  action,
  actionLabel,
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
  actionLabel?: ReactNode;
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
        paddingBottom: 16,
        background: "fieldSurface",
        border: "1px solid token(colors.fieldBorder)",
        borderRadius: 8,
      })}
    >
      <div
        className={css({
          position: "absolute",
          inset: "0 0 auto 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px 0",
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {label ? <label htmlFor={id}>{label}</label> : <div />}
        {actionLabel && <div>{actionLabel}</div>}
      </div>
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
            height: 136 - 2, // account for the 1px border
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
            inset: "48px 16px auto auto",
          })}
        >
          {action}
        </div>
      )}
      <div
        className={css({
          position: "absolute",
          inset: "auto 16px 16px",
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
