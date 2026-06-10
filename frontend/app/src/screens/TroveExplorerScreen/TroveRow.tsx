import type { TroveExplorerItem } from "@/src/types";

import { AddressLink } from "@/src/comps/AddressLink/AddressLink";
import { Amount } from "@/src/comps/Amount/Amount";
import { getLiquidationPrice, getLtv } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

type Props = {
  trove: TroveExplorerItem;
};

export function TroveRow({ trove }: Props) {
  const collPrice = usePrice(trove.collateralSymbol);

  const collateralValue = collPrice.data
    ? dn.mul(trove.deposit, collPrice.data)
    : null;

  const liquidationPrice = getLiquidationPrice(
    trove.deposit,
    trove.borrowed,
    Number(trove.minCollRatio) / 1e18,
  );

  const ltv = collPrice.data
    ? getLtv(trove.deposit, trove.borrowed, collPrice.data)
    : null;

  const statusLabel: Record<string, string> = {
    active: "Active",
    closed: "Closed",
    closedByOwner: "Closed",
    liquidated: "Liquidated",
    redeemed: "Redeemed",
  };

  const statusColor: Record<string, string> = {
    active: "#16a34a",
    closed: "#6b7280",
    closedByOwner: "#6b7280",
    liquidated: "#dc2626",
    redeemed: "#d97706",
  };

  return (
    <tr>
      <td>
        <span
          className={css({
            fontSize: 12,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 999,
          })}
          style={{
            color: statusColor[trove.status] ?? "#6b7280",
            background: `${statusColor[trove.status] ?? "#6b7280"}18`,
          }}
        >
          {statusLabel[trove.status] ?? trove.status}
        </span>
      </td>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
          })}
        >
          <TokenIcon symbol={trove.collateralSymbol} size="mini" />
          <Amount value={trove.deposit} suffix={` ${trove.collateralSymbol}`} />
        </div>
      </td>
      <td>
        <Amount value={trove.borrowed} suffix=" USND" />
      </td>
      <td>
        <Amount value={collateralValue} prefix="$" format="compact" />
      </td>
      <td>
        <Amount value={liquidationPrice} prefix="$" />
      </td>
      <td>
        <Amount value={ltv} percentage />
      </td>
      <td>
        <Amount value={trove.interestRate} percentage />
      </td>
      <td>
        <AddressLink address={trove.borrower} />
      </td>
    </tr>
  );
}
