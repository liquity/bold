import type { CollIndex, PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";
import { ReactNode } from "react";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { useCollateral } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";

export function RewardsPanel({
  collIndex,
  position,
}: {
  collIndex: null | CollIndex;
  position?: PositionEarn;
}) {
  const account = useAccount();

  const collateral = useCollateral(collIndex);
  const collPriceUsd = usePrice(collateral?.symbol ?? null);
  const boldPriceUsd = usePrice("BOLD");

  if (!collPriceUsd || !boldPriceUsd || !collateral) {
    return null;
  }

  const totalRewards = dn.add(
    dn.mul(position?.rewards?.bold ?? DNUM_0, boldPriceUsd),
    dn.mul(position?.rewards?.coll ?? DNUM_0, collPriceUsd),
  );

  const gasFeeUsd = dn.multiply(dn.from(0.0015, 18), collPriceUsd);

  const allowSubmit = account.isConnected;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        gap: 58,
      }}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "0 16px",
          background: "surface",
          border: "1px solid token(colors.border)",
          borderRadius: 8,
        })}
      >
        <div
          className={css({
            paddingTop: 8,
            fontSize: 16,
            fontWeight: 500,
            color: "contentAlt",
          })}
        >
          {content.earnScreen.rewardsPanel.label}
        </div>

        <div
          className={css({
            display: "flex",
            gap: 32,
          })}
        >
          <RewardsAmount
            symbol="BOLD"
            tooltip={<InfoTooltip {...infoTooltipProps(content.earnScreen.infoTooltips.rewardsBold)} />}
            value={position?.rewards?.bold ?? DNUM_0}
          />
          <RewardsAmount
            symbol={collateral.symbol}
            tooltip={<InfoTooltip {...infoTooltipProps(content.earnScreen.infoTooltips.rewardsEth)} />}
            value={position?.rewards?.coll ?? DNUM_0}
          />
        </div>

        <div
          className={css({
            display: "flex",
            gap: 16,
            marginTop: -1,
            padding: "20px 0",
            color: "contentAlt",
            borderTop: "1px solid token(colors.border)",
          })}
        >
          {content.earnScreen.rewardsPanel.details(
            dn.format(totalRewards, 2),
            dn.format(gasFeeUsd, 2),
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          width: "100%",
        }}
      >
        <ConnectWarningBox />
        <Button
          disabled={!allowSubmit}
          label={content.earnScreen.rewardsPanel.action}
          mode="primary"
          size="large"
          wide
        />
      </div>
    </div>
  );
}

function RewardsAmount({
  symbol,
  tooltip,
  value,
}: {
  symbol: string;
  tooltip?: ReactNode;
  value: Dnum;
}) {
  return (
    <div
      className={css({
        display: "flex",
        gap: 16,
        alignItems: "flex-end",
      })}
    >
      <div
        className={css({
          fontSize: 24,
        })}
      >
        {dn.format(value)}
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingBottom: 3,
          color: "contentAlt",
        })}
      >
        <div>{symbol}</div>
        {tooltip}
      </div>
    </div>
  );
}
