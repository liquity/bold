import type { CollIndex, PositionEarn, TokenSymbol } from "@/src/types";
import type { Dnum } from "dnum";
import { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { getCollToken } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Arbitrum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { Button, HFlex, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";

export function PanelClaimRewards({
  collIndex,
  position,
}: {
  collIndex: null | CollIndex;
  position?: PositionEarn;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collateral = getCollToken(collIndex);
  if (!collateral) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }

  const boldPriceUsd = usePrice("USDN");
  const collPriceUsd = usePrice(collateral.symbol ?? null);

  const totalRewards =
    collPriceUsd &&
    boldPriceUsd &&
    dn.add(
      dn.mul(position?.rewards?.bold ?? DNUM_0, boldPriceUsd),
      dn.mul(position?.rewards?.coll ?? DNUM_0, collPriceUsd)
    );

  const gasFeeUsd =
    collPriceUsd && dn.multiply(dn.from(0.0015, 18), collPriceUsd);

  const allowSubmit =
    account.isConnected && totalRewards && dn.gt(totalRewards, 0);

  return (
    <VFlex gap={48}>
      <VFlex gap={0}>
        <Rewards
          amount={position?.rewards?.bold ?? DNUM_0}
          label={content.earnScreen.rewardsPanel.boldRewardsLabel}
          symbol='USDN'
        />
        <Rewards
          amount={position?.rewards?.coll ?? DNUM_0}
          label={content.earnScreen.rewardsPanel.collRewardsLabel}
          symbol={collateral.symbol}
        />

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "24px 0",
            color: "contentAlt",
          })}
        >
          <HFlex justifyContent='space-between' gap={24}>
            <div>{content.earnScreen.rewardsPanel.totalUsdLabel}</div>
            <Amount prefix='$' value={totalRewards} format={2} />
          </HFlex>
          <HFlex justifyContent='space-between' gap={24}>
            <div>{content.earnScreen.rewardsPanel.expectedGasFeeLabel}</div>
            <Amount prefix='~$' value={gasFeeUsd} format={2} />
          </HFlex>
        </div>
      </VFlex>

      <ConnectWarningBox />

      <Button
        disabled={!allowSubmit}
        label={content.earnScreen.rewardsPanel.action}
        mode='primary'
        size='large'
        wide
        onClick={() => {
          if (!account.address || !position) {
            return;
          }
          txFlow.start({
            flowId: "earnClaimRewards",
            backLink: [
              `/earn/${collateral.name.toLowerCase()}`,
              "Back to earn position",
            ],
            successLink: ["/", "Go to the Dashboard"],
            successMessage: "The rewards have been claimed successfully.",
            earnPosition: position,
          });
        }}
      />
    </VFlex>
  );
}

function Rewards({
  amount,
  label,
  symbol,
}: {
  amount: Dnum;
  label: ReactNode;
  symbol: TokenSymbol;
}) {
  return (
    <div
      className={css({
        display: "grid",
        gap: 24,
        gridTemplateColumns: "1.2fr 1fr",
        alignItems: "start",
        padding: "24px 0",
        borderBottom: "1px solid token(colors.separator)",
      })}
    >
      <div>{label}</div>
      <div
        className={css({
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          fontSize: 28,
        })}
      >
        <Amount value={amount} />
        <TokenIcon symbol={symbol} size={24} />
      </div>
    </div>
  );
}
