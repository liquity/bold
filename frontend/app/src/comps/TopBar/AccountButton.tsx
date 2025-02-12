import content from "@/src/content";
import { useDemoMode } from "@/src/demo-mode";
import { useAccount } from "@/src/services/Arbitrum";
import { css } from "@/styled-system/css";
import { Button, IconAccount, shortenAddress } from "@liquity2/uikit";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { match, P } from "ts-pattern";
import { MenuItem } from "./MenuItem";

type ButtonData = {
  label: string;
  onClick: () => void;
  title?: string;
  variant?: "normal" | "connected";
};

export function AccountButton() {
  const account = useAccount();
  const demoMode = useDemoMode();

  return demoMode.enabled ? (
    <ButtonDemoMode />
  ) : (
    <ConnectButton.Custom>
      {({ chain, openChainModal, openConnectModal }) => {
        const button = match({ account, chain })
          .returnType<ButtonData>()
          .with(
            // wrong network
            { chain: { unsupported: true } },
            () => ({
              label: content.accountButton.wrongNetwork,
              onClick: openChainModal,
            })
          )
          .with(
            // connected
            { account: { address: P.nonNullable } },
            ({ account }) => ({
              label: account.ensName ?? shortenAddress(account.address, 3),
              onClick: account.disconnect,
              title: account.address,
              variant: "connected",
            })
          )
          .otherwise(
            // disconnected / not ready
            () => ({
              label: content.accountButton.connectAccount,
              onClick: openConnectModal,
            })
          );

        return button.variant === "connected" ? (
          <ButtonConnected button={button} />
        ) : (
          <Button mode='primary' {...button} />
        );
      }}
    </ConnectButton.Custom>
  );
}

function ButtonDemoMode() {
  const { account, updateAccountConnected } = useDemoMode();
  return account.isConnected ? (
    <ButtonConnected
      button={{
        label: "demo.eth",
        onClick: () => {
          updateAccountConnected(false);
        },
      }}
    />
  ) : (
    <Button
      mode='primary'
      label='Connect'
      onClick={() => {
        updateAccountConnected(true);
      }}
    />
  );
}

function ButtonConnected({ button }: { button: ButtonData }) {
  return (
    <button
      onClick={button.onClick}
      title={button.title}
      className={css({
        display: "flex",
        height: "100%",
        padding: 0,
        whiteSpace: "nowrap",
        _active: {
          translate: "0 1px",
        },
        _focusVisible: {
          borderRadius: 4,
          outline: "2px solid token(colors.focused)",
        },
      })}
    >
      <MenuItem icon={<IconAccount />} label={button.label} />
    </button>
  );
}
