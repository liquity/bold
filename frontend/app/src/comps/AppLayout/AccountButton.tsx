import type { ComponentPropsWithRef, ReactNode } from "react";

import content from "@/src/content";
import { css } from "@/styled-system/css";
import { Button, shortenAddress, ShowAfter } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { ConnectKitButton } from "connectkit";
import { match, P } from "ts-pattern";
import { MenuItem } from "./MenuItem";

export function AccountButton({ size = "small" }: { size?: "small" | "mini" }) {
  return (
    <ShowAfter delay={500}>
      <ConnectKitButton.Custom>
        {(props) => <CKButton {...props} size={size} />}
      </ConnectKitButton.Custom>
    </ShowAfter>
  );
}

function CKButton({
  chain,
  isConnected,
  isConnecting,
  address,
  ensName,
  show,
  size = "small",
}: Parameters<
  NonNullable<
    ComponentPropsWithRef<
      typeof ConnectKitButton.Custom
    >["children"]
  >
>[0] & { size?: "small" | "mini" }) {
  const status = match({ chain, isConnected, isConnecting, address })
    .returnType<
      | { mode: "connected"; address: `0x${string}` }
      | { mode: "connecting" | "disconnected" | "unsupported"; address?: never }
    >()
    .with(
      P.union(
        { chain: { unsupported: true } },
        { isConnected: true, chain: P.nullish },
      ),
      () => ({ mode: "unsupported" }),
    )
    .with({ isConnected: true, address: P.nonNullable }, ({ address }) => ({
      address,
      mode: "connected",
    }))
    .with({ isConnecting: true }, () => ({ mode: "connecting" }))
    .otherwise(() => ({ mode: "disconnected" }));

  const transition = useTransition(status, {
    keys: ({ mode }) => String(mode === "connected"),
    from: { opacity: 0, transform: "scale(0.9)" },
    enter: { opacity: 1, transform: "scale(1)" },
    leave: { opacity: 0, immediate: true },
    config: { mass: 1, tension: 2400, friction: 80 },
  });

  return transition((spring, { mode, address }) => (
    <a.div
      style={spring}
    >
      {mode === "connected"
        ? (
          <ButtonConnected
            label={ensName ?? shortenAddress(address, 3)}
            onClick={show}
            title={address}
            size={size}
          />
        )
        : (
          <Button
            mode="primary"
            size={size}
            shape="rounded"
            wide
            label={mode === "connecting"
              ? "Connecting…"
              : mode === "unsupported"
                ? content.accountButton.wrongNetwork
                : content.accountButton.connectAccount}
            onClick={show}
          />
        )}
    </a.div>
  ));
}

function ButtonConnected({
  label,
  onClick,
  title,
  size = "small",
}: {
  label: ReactNode;
  onClick?: () => void;
  title?: string;
  size?: "small" | "mini";
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={css({
        display: "flex",
        height: "100%",
        maxWidth: 140,
        padding: size === "small" ? "8px 16px" : "4px 12px",
        whiteSpace: "nowrap",
        textAlign: "center",
        _active: {
          translate: "0 1px",
        },
        border: size === "small" ? "2px solid token(colors.fieldBorder)" : "1px solid token(colors.fieldBorder)",
        borderRadius: 20,
        background: "neutralDimmed300",
      })}
    >
      <MenuItem
        icon={undefined}
        label={label}
      />
    </button>
  );
}
