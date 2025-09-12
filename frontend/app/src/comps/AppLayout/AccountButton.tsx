import type { ComponentPropsWithRef } from "react";

import content from "@/src/content";
import { css } from "@/styled-system/css";
import { Button, IconAccount, shortenAddress, ShowAfter } from "@liquity2/uikit";
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
      ? "Connecting…"
      : mode === "unsupported"
      ? content.accountButton.wrongNetwork
      : content.accountButton.connectAccount,
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
        size="medium"
        className={css({
          hideBelow: "medium",
        })}
      />
      <Button
        {...props}
        size="medium"
        className={css({
          hideFrom: "medium",
          height: "32px!",
        })}
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
      className={css({
        display: "grid",
        width: "100%",
        height: "100%",
        padding: 0,
        whiteSpace: "nowrap",
        textAlign: "center",
        _active: {
          translate: "0 1px",
        },
        _focusVisible: {
          borderRadius: 4,
          outline: "2px solid token(colors.focused)",
        },
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          height: "100%",
          cursor: "pointer",
          userSelect: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: "interactive",
        })}
      >
        <div
          className={css({
            display: "grid",
            placeItems: "center",
            width: 24,
            height: 24,
          })}
        >
          <IconAccount />
        </div>
        <div
          className={css({
            flexShrink: 1,
            flexGrow: 1,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            height: "100%",
          })}
        >
          <div
            className={css({
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            })}
          >
            {label}
          </div>
        </div>
      </div>
    </button>
  );
}
