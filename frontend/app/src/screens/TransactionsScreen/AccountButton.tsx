import type { Address } from "@/src/types";

import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { css } from "@/styled-system/css";
import { shortenAddress } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";

export function AccountButton({
  address,
}: {
  address: Address;
}) {
  return (
    <LinkTextButton
      key="start"
      label={
        <div
          title={address}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
          })}
        >
          <Image
            alt=""
            width={16}
            height={16}
            src={blo(address)}
            className={css({
              display: "block",
              borderRadius: 4,
            })}
          />
          {shortenAddress(address, 4).toLowerCase()}
        </div>
      }
      href={`${CHAIN_BLOCK_EXPLORER?.url}address/${address}`}
      external
    />
  );
}
