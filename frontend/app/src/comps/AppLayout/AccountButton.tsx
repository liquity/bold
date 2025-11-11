import type { ComponentPropsWithRef } from "react";

import content from "@/src/content";
import { css } from "@/styled-system/css";
import { Button, shortenAddress, ShowAfter } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { ConnectKitButton } from "connectkit";
import { match, P } from "ts-pattern";
import { useSwitchChain } from "wagmi";

export function AccountButton() {
  return (
    <ShowAfter delay={500}>
      <ConnectKitButton.Custom>
        {(props) => <CKButton {...props} />}
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
}: Parameters<
  NonNullable<
    ComponentPropsWithRef<
      typeof ConnectKitButton.Custom
    >["children"]
  >
>[0]) {
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
    leave: { opacity: 0, display: "none", immediate: true },
    config: { mass: 1, tension: 2400, friction: 80 },
  });

  return transition((spring, { mode, address }) => {
    const containerProps = {
      className: css({
        display: "flex",
        alignItems: "center",
        height: "100%",
      }),
      style: spring,
    } as const;
    return mode === "connected"
      ? (
        <a.div {...containerProps}>
          <ButtonConnected
            label={ensName ?? shortenAddress(address, 3)}
            onClick={show}
            title={address}
          />
        </a.div>
      )
      : (
        <a.div {...containerProps}>
          <ButtonNotConnected
            mode={mode}
            show={show}
          />
        </a.div>
      );
  });
}

function ButtonNotConnected({
  mode,
  show,
}: {
  mode: "connecting" | "disconnected" | "unsupported";
  show?: () => void;
}) {
  const { switchChain, chains } = useSwitchChain();

  const props = {
    mode: "primary",
    label: mode === "connecting"
      ? "CONNECTING…"
      : mode === "unsupported"
      ? content.accountButton.wrongNetwork
      : "CONNECT",
    onClick: mode === "unsupported"
      ? () => {
        switchChain({ chainId: chains[0].id });
      }
      : show,
  } as const;

  return (
    <>
      <Button
        {...props}
        size="small"
        className={`font-audiowide ${css({
          hideBelow: "medium",
          background: "#A189AB!",
          color: "white!",
          height: "25px!",
          border: "none!",
          borderRadius: "9999px!",
          padding: "0px 16px!",
          textTransform: "uppercase",
          fontSize: "12px!",
          fontWeight: 400,
          lineHeight: "112%",
          cursor: "pointer",
          transition: "all 0.2s",
          "&:hover": {
            background: "#8A7094!",
            transform: "translateY(-2px)",
          },
        })}`}
      />
      <Button
        {...props}
        size="small"
        className={`font-audiowide ${css({
          hideFrom: "medium",
          height: "25px!",
          background: "#A189AB!",
          color: "white!",
          border: "none!",
          borderRadius: "9999px!",
          padding: "8px 16px!",
          textTransform: "uppercase",
          fontSize: "12px!",
          fontWeight: 400,
          lineHeight: "112%",
        })}`}
      />
    </>
  );
}

function ButtonConnected({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`font-audiowide ${css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: "25px",
        padding: "0 16px",
        background: "#A189AB",
        color: "white",
        border: "none",
        borderRadius: "9999px",
        textTransform: "uppercase",
        fontSize: "12px!",
        fontWeight: 400,
        lineHeight: "112%",
        cursor: "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        "&:hover": {
          background: "#8A7094",
          transform: "translateY(-2px)",
        },
        _active: {
          translate: "0 1px",
        },
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: 2,
        },
      })}`}
    >
      {label}
    </button>
  );
}