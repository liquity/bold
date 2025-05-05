import type { Address } from "@/src/types";
import { ReactNode } from "react";

import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { css } from "@/styled-system/css";
import { shortenAddress } from "@liquity2/uikit";
import { blo } from "blo";
import Image from "next/image";

export function AddressLink({
  address,
  label,
}: {
  address: Address;
  label?: ReactNode;
}) {
  if (!CHAIN_BLOCK_EXPLORER) {
    throw new Error("CHAIN_BLOCK_EXPLORER is not defined");
  }
  return (
    <LinkTextButton
      external
      href={`${CHAIN_BLOCK_EXPLORER.url}address/${address}`}
      label={
        <div
          className={css({
            display: "flex",
            gap: 4,
            alignItems: "center",
          })}
        >
          <Image
            alt=""
            width={16}
            height={16}
            src={blo(address)}
            className={css({
              borderRadius: "50%",
            })}
          />
          {label ?? shortenAddress(address, 3)}
        </div>
      }
    />
  );
}
