import { shortenAddress } from "@/src/eth-utils";
import { ConnectKitButton } from "connectkit";
import { match, P } from "ts-pattern";
import { IconAccount } from "./icons";
import { MenuItem } from "./MenuItem";

export function AccountButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address, ensName }) => (
        <button onClick={show}>
          <MenuItem
            icon={<IconAccount />}
            label={match({ isConnected, address, ensName })
              .with({
                ensName: P.string.minLength(1),
                isConnected: true,
              }, ({ ensName }) => ensName)
              .with({
                address: P.string.minLength(42),
                isConnected: true,
              }, ({ address }) => (
                shortenAddress(address, 4)
              ))
              .otherwise(() => "Connect")}
          />
        </button>
      )}
    </ConnectKitButton.Custom>
  );
}
