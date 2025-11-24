import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css, cx } from "@/styled-system/css";

type FlowRequest = Parameters<
  ReturnType<typeof useTransactionFlow>["start"]
>[0];

type FlowRequestParam = FlowRequest | null | undefined;

export function PurpleButton({
  children,
  className,
  size = "medium",
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  size?: "medium" | "large";
}) {
  return (
    <button
      type="button"
      className={cx(
        "font-audiowide",
        css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: size === "large" ? "0 30px" : "12px 14px",
          background: "#a189ab",
          color: "white",
          border: "none",
          borderRadius: size === "large" ? 120 : "50px",
          textTransform: "uppercase",
          fontSize: size === "large" ? 24 : "12px",
          fontWeight: 400,
          lineHeight: "1.12",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s",
          height: size === "large" ? 74 : "auto",
          _focusVisible: {
            outline: "2px solid token(colors.focused)",
            outlineOffset: 2,
          },
          _active: {
            _enabled: {
              transform: "translateY(1px)",
              opacity: 0.9,
            },
          },
          _hover: {
            _enabled: {
              opacity: 0.9,
            },
          },
          _disabled: {
            background: "token(colors.disabledSurface)",
            color: "token(colors.disabledContent)",
            border: "1px solid token(colors.disabledBorder)",
            cursor: "not-allowed",
            opacity: 1,
          },
        }),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function FlowButton({
  disabled,
  footnote,
  label,
  request,
}: {
  disabled?: boolean;
  footnote?: ReactNode;
  label?: string;
  request?: (() => FlowRequestParam) | FlowRequestParam;
}) {
  const txFlow = useTransactionFlow();
  const isDisabled = disabled || !request;

  return (
    <>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
        })}
      >
        <ConnectWarningBox />
        <PurpleButton
          disabled={isDisabled}
          onClick={() => {
            if (typeof request === "function") {
              request = request();
            }
            if (request) {
              txFlow.start(request);
            }
          }}
        >
          {label ?? "Next: Summary"}
        </PurpleButton>
      </div>
      {footnote && (
        <div
          className={css({
            fontSize: 14,
            textAlign: "center",
          })}
        >
          {footnote}
        </div>
      )}
    </>
  );
}
