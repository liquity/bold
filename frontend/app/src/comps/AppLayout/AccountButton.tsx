import type { ComponentPropsWithRef, ReactNode } from "react";

import { useBreakpoint } from "@/src/breakpoints";
import content from "@/src/content";
import { useDemoMode } from "@/src/demo-mode";
import { css } from "@/styled-system/css";
import { Button, IconAccount, shortenAddress, ShowAfter } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { ConnectKitButton } from "connectkit";
import { useState } from "react";
import { match, P } from "ts-pattern";
import { MenuItem } from "./MenuItem";

export function AccountButton() {
  const demoMode = useDemoMode();
  if (demoMode.enabled) {
    return <DemoModeAccountButton />;
  }
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
  const props = {
    mode: "primary",
    label: mode === "connecting"
      ? "Connecting…"
      : mode === "unsupported"
      ? content.accountButton.wrongNetwork
      : content.accountButton.connectAccount,
    onClick: show,
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

function DemoModeAccountButton() {
  const { account, updateAccountConnected } = useDemoMode();
  const onClick = () => {
    updateAccountConnected(!account.isConnected);
  };
  return account.isConnected
    ? <ButtonConnected label="demo.eth" onClick={onClick} />
    : <Button mode="primary" label="Connect" onClick={onClick} />;
}

function ButtonConnected({
  label,
  onClick,
  title,
}: {
  label: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const [showIcon, setShowIcon] = useState(false);
  useBreakpoint((breakpoint) => {
    setShowIcon(breakpoint.medium);
  });
  return (
    <button
      onClick={onClick}
      title={title}
      className={css({
        display: "flex",
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
      <MenuItem
        icon={showIcon && <IconAccount />}
        label={label}
      />
    </button>
  );
}
