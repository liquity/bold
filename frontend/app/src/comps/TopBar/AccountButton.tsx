import type { ReactNode } from "react";

import content from "@/src/content";
import { useDemoMode } from "@/src/demo-mode";
import { useAccount } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { Button, IconAccount, shortenAddress, ShowAfter } from "@liquity2/uikit";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { match, P } from "ts-pattern";
import { MenuItem } from "./MenuItem";

export function AccountButton() {
  const account = useAccount();
  const demoMode = useDemoMode();

  if (demoMode.enabled) {
    return <ButtonDemoMode />;
  }

  return (
    <ConnectButton.Custom>
      {({ chain, openChainModal, openConnectModal }) => {
        return match({ account, chain })
          // wrong network
          .with(
            { chain: { unsupported: true } },
            () => (
              <Button
                mode="primary"
                label={content.accountButton.wrongNetwork}
                onClick={openChainModal}
              />
            ),
          )
          // connected
          .with(
            { account: { address: P.nonNullable } },
            ({ account }) => (
              <ButtonConnected
                label={account.ensName ?? shortenAddress(account.address, 3)}
                onClick={account.disconnect}
                title={account.address}
              />
            ),
          )
          // connecting
          .with(
            { account: { status: "connecting" } },
            () => (
              <div>
                <ShowAfter delay={500}>
                  <ButtonConnected
                    label="connecting…"
                    onClick={() => {
                      account.disconnect();
                    }}
                  />
                </ShowAfter>
              </div>
            ),
          )
          // disconnected
          .otherwise(() => (
            <Button
              mode="primary"
              label={content.accountButton.connectAccount}
              onClick={openConnectModal}
            />
          ));
      }}
    </ConnectButton.Custom>
  );
}

function ButtonDemoMode() {
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
  onClick: () => void;
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
