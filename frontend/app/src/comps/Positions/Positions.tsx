import type { PositionEarn, PositionLoan } from "@/src/types";
import type { ReactNode } from "react";

import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import content from "@/src/content";
import { ACCOUNT_POSITIONS } from "@/src/demo-data";
import { css } from "@/styled-system/css";
import { StatusDot, StrongCard, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { match } from "ts-pattern";
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
          {ACCOUNT_POSITIONS.map((position, index) => (
            match(position)
              .with({ type: "loan" }, ({ type, ...props }) => <PositionLoan key={index} {...props} />)
              .with({ type: "earn" }, ({ type, ...props }) => <PositionEarn key={index} {...props} />)
              .otherwise(() => null)
          ))}
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

function PositionLoan({
  borrowed,
  collateral,
  deposit,
  interestRate,
  troveId,
  ltv,
}: Pick<
  PositionLoan,
  | "borrowed"
  | "collateral"
  | "deposit"
  | "interestRate"
  | "troveId"
  | "ltv"
>) {
  const token = TOKENS_BY_SYMBOL[collateral];
  return (
    <Link
      href={{
        pathname: "/loan",
        query: { id: String(troveId) },
      }}
      legacyBehavior
      passHref
    >
      <StrongCard
        title={`Loan #${troveId}`}
        heading="Loan"
        rows={[
          [
            {
              label: "Deposit",
              value: (
                <FlexRow>
                  <TokenIcon
                    size="small"
                    symbol={token.symbol}
                  />
                  <div>
                    {dn.format(deposit, 4)} {token.name}
                  </div>
                </FlexRow>
              ),
            },
            {
              label: "LTV",
              value: (
                <FlexRow>
                  <div>
                    {dn.format(dn.mul(ltv, 100), 2)}%
                  </div>
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
                    {dn.format(borrowed, 4)} BOLD
                  </div>
                </FlexRow>
              ),
            },
            {
              label: "Int. Rate",
              value: (
                <FlexRow>
                  <div>
                    {dn.format(dn.mul(interestRate, 100), 2)}%
                  </div>
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

function PositionEarn({
  apy,
  collateral,
  deposit,
  rewards,
}: Pick<
  PositionEarn,
  | "apy"
  | "collateral"
  | "deposit"
  | "rewards"
>) {
  const token = TOKENS_BY_SYMBOL[collateral];
  return (
    <Link
      href={`/earn/${token.symbol.toLowerCase()}`}
      legacyBehavior
      passHref
    >
      <StrongCard
        heading={[
          "Earn",
          // eslint-disable-next-line react/jsx-key
          <FlexRow>
            <div>{token.name} pool</div>
            <TokenIcon size="small" symbol={token.symbol} />
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
                  <div>{dn.format(deposit, 4)} BOLD</div>
                </FlexRow>
              ),
            },
            {
              label: "APY",
              value: dn.format(dn.mul(apy, 100), 2) + "%",
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
                    {dn.format(rewards.bold)} BOLD
                  </div>
                  <div
                    className={css({
                      fontSize: 14,
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    +{dn.format(rewards.eth)} {token.name}
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
