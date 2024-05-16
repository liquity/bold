import type { ReactNode } from "react";

import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { StrongCard, StatusDot, TokenIcon } from "@liquity2/uikit";
import Link from "next/link";
import { useAccount } from "wagmi";

export function Positions() {
  const account = useAccount();
  return account.isConnected
    ? (
      <div>
        <h1
          className={css({
            paddingBottom: 32,
            fontSize: 32,
            color: "content",
          })}
        >
          {content.home.myPositionsTitle}
        </h1>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
          })}
        >
          <PositionBorrow />
          <PositionEarn />
        </div>
      </div>
    )
    : (
      <div>
        <h1
          className={css({
            paddingBottom: 48,
            fontSize: 32,
            color: "content",
          })}
        >
          {content.home.openPositionTitle}
        </h1>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
          })}
        >
          <ActionCard type="borrow" />
          <ActionCard type="leverage" />
          <ActionCard type="earn" />
          <ActionCard type="stake" />
        </div>
      </div>
    );
}

function PositionBorrow() {
  return (
    <Link href="/borrow" passHref legacyBehavior>
      <StrongCard
        heading="Borrow"
        rows={[
          [
            {
              label: "Deposit",
              value: (
                <FlexRow>
                  <TokenIcon
                    size="small"
                    symbol="RETH"
                  />
                  <div>5.50 rETH</div>
                </FlexRow>
              ),
            },
            {
              label: "LTV",
              value: (
                <FlexRow>
                  <div>61.00%</div>
                  <StatusDot mode="positive" size={8} />
                </FlexRow>
              ),
            },
          ],
          [
            {
              label: "Borrowed",
              value: (
                <FlexRow>
                  <div>
                    25,789.00 BOLD
                  </div>
                </FlexRow>
              ),
            },
            {
              label: "Int. Rate",
              value: (
                <FlexRow>
                  <div>5.7%</div>
                  <StatusDot mode="positive" size={8} />
                </FlexRow>
              ),
            },
          ],
        ]}
      />
    </Link>
  );
}

function PositionEarn() {
  return (
    <Link href="/earn" passHref legacyBehavior>
      <StrongCard
        heading={[
          "Earn",
          // eslint-disable-next-line react/jsx-key
          <FlexRow>
            <div>stETH pool</div>
            <TokenIcon size="small" symbol="WSTETH" />
          </FlexRow>,
        ]}
        rows={[
          [
            {
              label: "Deposit",
              value: (
                <FlexRow>
                  <TokenIcon
                    size="small"
                    symbol="BOLD"
                  />
                  <div>5,000 BOLD</div>
                </FlexRow>
              ),
            },
            {
              label: "APY",
              value: "7.80%",
            },
          ],
          [
            {
              label: "Rewards",
              value: (
                <FlexRow>
                  <div
                    className={css({
                      fontSize: 14,
                      color: "positive",
                    })}
                  >
                    25,789.00 BOLD
                  </div>
                  <div
                    className={css({
                      fontSize: 14,
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    +0.943 swETH
                  </div>
                </FlexRow>
              ),
            },
            null,
          ],
        ]}
      />
    </Link>
  );
}

function FlexRow({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
      })}
    >
      {children}
    </div>
  );
}
