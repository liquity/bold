import { css } from "@/styled-system/css";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { match, P } from "ts-pattern";
import { IconAccount } from "./icons";
import { MenuItem } from "./MenuItem";

export function AccountButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal }) => {
        const button = match({ account, chain })
          .with(
            // wrong network
            { chain: { unsupported: true } },
            () => ({ label: "Wrong network", onClick: openChainModal }),
          )
          .with(
            // connected
            { account: P.nonNullable },
            ({ account }) => ({ label: account.displayName, onClick: openAccountModal }),
          )
          .otherwise(
            // disconnected / not ready
            () => ({ label: "Connect", onClick: openConnectModal }),
          );

        return button && (
          <button
            onClick={button.onClick}
            className={css({
              display: "flex",
              height: "100%",
              padding: "0 0 0 8px",
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
      }}
    </ConnectButton.Custom>
  );
}
