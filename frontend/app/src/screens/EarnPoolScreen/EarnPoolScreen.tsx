"use client";

import type { PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import { BackButton } from "@/src/comps/BackButton/BackButton";
import { Details } from "@/src/comps/Details/Details";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ACCOUNT_POSITIONS, EARN_POOLS } from "@/src/demo-mode";
import { useAccount } from "@/src/eth/Ethereum";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { COLLATERALS, HFlex, InfoTooltip, Tabs, TokenIcon, TokenIconGroup, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
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

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);
function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  console.log(symbol, collateralSymbols);
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

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
              value: `${dn.format(position.deposit, { digits: 2, trailingZeros: true })} BOLD`,
            },
            {
              label: content.earnScreen.accountPosition.shareLabel,
              value: poolSharePercentage && (
                <span title={`${dn.format(poolSharePercentage)}%`}>
                  {`${dn.format(poolSharePercentage, { digits: 2, trailingZeros: true })}%`}
                </span>
              ),
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
                  {dn.format(position.rewards.bold, 2)} BOLD
                  <div
                    className={css({
                      display: "flex",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: "dimmed",
                    })}
                  />
                  {dn.format(position.rewards.eth, 2)} ETH
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
              {content.earnScreen.headerTvl(`${dn.format(boldQty, { compact: true })} BOLD`)}
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
          {dn.format(dn.mul(apr, 100), 2)}%
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
