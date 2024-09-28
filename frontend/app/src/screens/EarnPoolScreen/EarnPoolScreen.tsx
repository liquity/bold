"use client";

import type { PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import { Amount } from "@/src/comps/Amount/Amount";
import { BackButton } from "@/src/comps/BackButton/BackButton";
import { Details } from "@/src/comps/Details/Details";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ACCOUNT_POSITIONS, EARN_POOLS } from "@/src/demo-mode";
import { useAccount } from "@/src/services/Ethereum";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  HFlex,
  InfoTooltip,
  isCollateralSymbol,
  Tabs,
  TokenIcon,
  TokenIconGroup,
  TOKENS_BY_SYMBOL,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { DepositPanel } from "./DepositPanel";
import { RewardsPanel } from "./RewardsPanel";
import { WithdrawPanel } from "./WithdrawPanel";

const TABS = [
  { action: "deposit", label: content.earnScreen.tabs.deposit },
  { action: "withdraw", label: content.earnScreen.tabs.withdraw },
  { action: "claim", label: content.earnScreen.tabs.claim },
] as const;

export function EarnPoolScreen() {
  const account = useAccount();
  const router = useRouter();
  const params = useParams();

  const collateralSymbol = String(params.pool).toUpperCase();

  if (!isCollateralSymbol(collateralSymbol)) {
    return null;
  }

  const pool = EARN_POOLS[collateralSymbol];

  const position: PositionEarn | undefined = ACCOUNT_POSITIONS.find((position) => (
    position.type === "earn" && position.collateral === collateralSymbol
  )) as PositionEarn | undefined;

  const accountBoldBalance = account.isConnected ? ACCOUNT_BALANCES.BOLD : undefined;

  const tab = TABS.find((tab) => tab.action === params.action) ?? TABS[0];

  const poolSharePercentage = position && dn.mul(dn.div(position.deposit, pool.boldQty), 100);

  const poolToken = TOKENS_BY_SYMBOL[collateralSymbol];

  return pool && tab && (
    <Screen>
      <BackButton href="/earn" label={content.earnScreen.backButton} />
      <PoolSummary
        apr={pool.apr}
        boldQty={pool.boldQty}
        symbol={collateralSymbol}
      />
      {position && (
        <Details
          items={[
            {
              label: content.earnScreen.accountPosition.depositLabel,
              value: <Amount value={position.deposit} suffix=" BOLD" />,
            },
            {
              label: content.earnScreen.accountPosition.shareLabel,
              value: <Amount percentage value={poolSharePercentage} />,
            },
            {
              label: content.earnScreen.accountPosition.rewardsLabel,
              value: position.rewards && (
                <HFlex
                  gap={8}
                  justifyContent="flex-start"
                  className={css({
                    fontSize: 14,
                    color: "positive",
                    whiteSpace: "nowrap",
                  })}
                >
                  <Amount value={position.rewards.bold} suffix=" BOLD" />
                  <div
                    className={css({
                      display: "flex",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: "dimmed",
                    })}
                  />
                  <Amount value={position.rewards.coll} suffix={` ${poolToken.name}`} />
                </HFlex>
              ),
            },
          ]}
        />
      )}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 24,
          width: "100%",
        })}
      >
        <Tabs
          selected={TABS.indexOf(tab)}
          onSelect={(index) => {
            router.push(`/earn/${collateralSymbol.toLowerCase()}/${TABS[index].action}`, {
              scroll: false,
            });
          }}
          items={TABS.map((tab) => ({
            label: tab.label,
            panelId: `panel-${tab.action}`,
            tabId: `tab-${tab.action}`,
          }))}
        />
        {tab.action === "deposit" && (
          <DepositPanel
            accountBoldBalance={accountBoldBalance}
            boldQty={pool.boldQty}
            position={position}
          />
        )}
        {tab.action === "withdraw" && (
          <WithdrawPanel
            boldQty={pool.boldQty}
            position={position}
          />
        )}
        {tab.action === "claim" && <RewardsPanel position={position} />}
      </div>
    </Screen>
  );
}

function PoolSummary({
  apr,
  boldQty,
  symbol,
}: {
  apr: Dnum;
  boldQty: Dnum;
  symbol: keyof typeof EARN_POOLS;
}) {
  const poolToken = TOKENS_BY_SYMBOL[symbol];
  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
        justifyContent: "space-between",
      })}
    >
      <div
        className={css({
          display: "flex",
          width: "100%",
          gap: 24,
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            paddingTop: 8,
          })}
        >
          <TokenIconGroup size="large">
            <TokenIcon symbol="BOLD" />
            <TokenIcon symbol={symbol} />
          </TokenIconGroup>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          })}
        >
          <div
            className={css({
              fontSize: 24,
            })}
          >
            {poolToken.name} pool
          </div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "contentAlt",
              whiteSpace: "nowrap",
            })}
          >
            <div>
              {content.earnScreen.headerTvl(
                <Amount
                  format="compact"
                  suffix=" BOLD"
                  value={boldQty}
                />,
              )}
            </div>
            <InfoTooltip {...infoTooltipProps(content.earnScreen.infoTooltips.tvl(poolToken.name))} />
          </div>
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-end",
        })}
      >
        <div
          className={css({
            fontSize: 24,
          })}
        >
          <Amount
            format={2}
            percentage
            value={apr}
          />
        </div>
        <div
          className={css({
            color: "contentAlt",
            whiteSpace: "nowrap",
          })}
        >
          {content.earnScreen.headerApr()}
        </div>
      </div>
    </div>
  );
}
