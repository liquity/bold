import type { ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { forwardRef, useId, useRef } from "react";
import { css, cx } from "../../styled-system/css";
import { IconCross } from "../icons";
import { useElementSize } from "../react-utils";

type InputFieldProps = {
  action?: ReactNode;
  actionLabel?: ReactNode;
  difference?: ReactNode;
  label?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onDifferenceClick?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  secondaryEnd?: ReactNode;
  secondaryStart?: ReactNode;
  value?: string;
};

const diffSpringConfig = {
  mass: 1,
  tension: 3000,
  friction: 120,
};

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField({
  action,
  actionLabel,
  difference,
  label,
  onBlur,
  onChange,
  onDifferenceClick,
  onFocus,
  placeholder,
  secondaryEnd,
  secondaryStart,
  value,
}, ref) {
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
      <input
        ref={ref}
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
          gap: 16,
          fontSize: 16,
          color: "contentAlt",
          pointerEvents: "none",
          "& > div": {
            pointerEvents: "auto",
          },
        })}
      >
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
          {secondaryStart}
        </div>
        <div
          className={css({
            flexGrow: 0,
            flexShrink: 1,
            display: "flex",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          })}
        >
          {secondaryEnd}
        </div>
      </div>
    </div>
  );
});
