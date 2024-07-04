import content from "@/src/content";
import { useAccount } from "@/src/eth/Ethereum";
import { css } from "@/styled-system/css";
import { Button, IconAccount } from "@liquity2/uikit";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { match, P } from "ts-pattern";
import { MenuItem } from "./MenuItem";

type ButtonData = {
  label: string;
  onClick: () => void;
  variant?: "normal" | "connected";
};

export function AccountButton() {
  const account = useAccount();
  return (
    <ConnectButton.Custom>
      {({ chain, openChainModal }) => {
        const button = match({ account, chain })
          .returnType<ButtonData>()
          .with(
            // wrong network
            { chain: { unsupported: true } },
            () => ({
              label: content.accountButton.wrongNetwork,
              onClick: openChainModal,
            }),
          )
          .with(
            // connected
            { account: { address: P.nonNullable } },
            ({ account }) => ({
              label: account.ensName ?? account.address,
              onClick: account.disconnect,
              variant: "connected",
            }),
          )
          .otherwise(
            // disconnected / not ready
            ({ account }) => ({
              label: content.accountButton.connectAccount,
              onClick: account.connect,
            }),
          );

        return button.variant === "connected"
          ? <ButtonConnected button={button} />
          : <Button mode="primary" {...button} />;
      }}
    </ConnectButton.Custom>
  );
}

function ButtonConnected({ button }: { button: ButtonData }) {
  return (
    <button
      onClick={button.onClick}
      className={css({
        display: "flex",
        height: "100%",
        padding: 0,
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
        label={button.label}
      />
    </button>
  );
}
