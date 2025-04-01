import type { ReactNode } from "react";

import content from "@/src/content";
import { useDemoMode } from "@/src/demo-mode";
import { CHAIN_ID } from "@/src/env";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { Button, IconAccount, shortenAddress, ShowAfter } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { match, P } from "ts-pattern";
import { MenuItem } from "./MenuItem";

export function AccountButton() {
  const {
    address,
    chain,
    connect,
    ensName,
    isConnected,
    isConnecting,
  } = useAccount();

  const demoMode = useDemoMode();
  if (demoMode.enabled) {
    return <DemoModeAccountButton />;
  }

  const status = match({
    address,
    chain,
    isChainSupported: chain ? chain.id === CHAIN_ID : undefined,
    isConnected,
    isConnecting,
  })
    .returnType<
      | { mode: "connected"; address: `0x${string}` }
      | { mode: "connecting" | "disconnected" | "unsupported"; address?: never }
    >()
    .with({ isChainSupported: false }, () => ({
      mode: "unsupported",
    }))
    .with({ isConnecting: true }, () => ({
      mode: "connecting",
    }))
    .with({ isConnected: true, address: P.nonNullable }, ({ address }) => ({
      address,
      mode: "connected",
    }))
    .otherwise(() => ({
      mode: "disconnected",
    }));

  const transition = useTransition(status, {
    keys: ({ mode }) => String(mode === "connected"),
    from: { opacity: 0, transform: "scale(0.9)" },
    enter: { opacity: 1, transform: "scale(1)" },
    leave: { opacity: 0, immediate: true },
    config: { mass: 1, tension: 2400, friction: 80 },
  });

  return (
    <ShowAfter delay={500}>
      {transition((spring, { mode, address }) => (
        <a.div style={spring}>
          {mode === "connected"
            ? (
              <ButtonConnected
                label={ensName ?? shortenAddress(address, 3)}
                onClick={connect}
                title={address}
              />
            )
            : (
              <Button
                mode="primary"
                label={mode === "connecting"
                  ? "Connecting…"
                  : mode === "unsupported"
                  ? content.accountButton.wrongNetwork
                  : content.accountButton.connectAccount}
                onClick={connect}
              />
            )}
        </a.div>
      ))}
    </ShowAfter>
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
  return (
    <button
      onClick={onClick}
      title={title}
      className={css({
        display: "flex",
        height: "100%",
        maxWidth: 140,
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
        icon={<IconAccount />}
        label={label}
      />
    </button>
  );
}
