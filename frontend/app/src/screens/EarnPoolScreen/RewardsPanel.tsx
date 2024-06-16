import type { PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { usePrice } from "@/src/prices";
import { css } from "@/styled-system/css";
import { Button } from "@liquity2/uikit";
import * as dn from "dnum";

export function RewardsPanel({
  position,
}: {
  position?: PositionEarn;
}) {
  const ethPriceUsd = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");

  const totalRewards = dn.add(
    dn.mul(position?.rewards?.bold ?? DNUM_0, boldPriceUsd),
    dn.mul(position?.rewards?.eth ?? DNUM_0, ethPriceUsd),
  );

  const gasFeeUsd = dn.multiply(dn.from(0.0015, 18), ethPriceUsd);

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
          background: "background",
          border: "1px solid token(colors.fieldBorder)",
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

        {position
          ? (
            <div
              className={css({
                display: "flex",
                gap: 32,
              })}
            >
              <Amount value={position.rewards?.bold} symbol="BOLD" />
              <Amount value={position.rewards?.eth} symbol="ETH" />
            </div>
          )
          : <div>N/A</div>}

        <div
          className={css({
            display: "flex",
            gap: 16,
            marginTop: -1,
            padding: "20px 0",
            color: "contentAlt",
            borderTop: "1px solid token(colors.fieldBorder)",
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
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          label={content.earnScreen.rewardsPanel.action}
          mode="primary"
          size="large"
          wide
        />
      </div>
    </div>
  );
}

function Amount({
  symbol,
  value,
}: {
  symbol: string;
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
          paddingBottom: 3,
          color: "contentAlt",
        })}
      >
        {symbol}
      </div>
    </div>
  );
}
