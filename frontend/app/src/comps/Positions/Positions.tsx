import type { PositionEarn, PositionLeverage, PositionLoan, PositionStake } from "@/src/types";
import type { ReactNode } from "react";

import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import { LQTY_SUPPLY } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { useAccount } from "@/src/eth/Ethereum";
import { getLiquidationRisk, getRedemptionRisk } from "@/src/liquity-math";
import { usePrice } from "@/src/prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  HFlex,
  IconBorrow,
  IconEdit,
  IconStake,
  StatusDot,
  StrongCard,
  TokenIcon,
  TOKENS_BY_SYMBOL,
} from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { match } from "ts-pattern";

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
              .with({ type: "leverage" }, ({ type, ...props }) => <PositionLeverage key={index} {...props} />)
              .with({ type: "stake" }, ({ type, ...props }) => <PositionStake key={index} {...props} />)
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
}: Pick<
  PositionLoan,
  | "borrowed"
  | "collateral"
  | "deposit"
  | "interestRate"
  | "troveId"
>) {
  const token = TOKENS_BY_SYMBOL[collateral];
  const collateralPriceUsd = usePrice(token.symbol);

  if (!collateralPriceUsd) {
    return null;
  }

  const ltv = dn.div(borrowed, dn.mul(deposit, collateralPriceUsd));
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = getLiquidationRisk(ltv, maxLtv);

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
        heading={
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt",
              })}
            >
              <IconBorrow size={16} />
            </div>
            BOLD loan
          </div>
        }
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              {dn.format(dn.add(deposit, borrowed), 4)}
              <TokenIcon
                size={24}
                symbol="BOLD"
              />
            </HFlex>
          ),
          label: "Total debt",
        }}
        secondary={
          <CardRows>
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    LTV
                  </div>
                  <div
                    className={css({
                      "--status-positive": "token(colors.positiveAlt)",
                      "--status-warning": "token(colors.warning)",
                      "--status-negative": "token(colors.negative)",
                    })}
                    style={{
                      color: liquidationRisk === "low"
                        ? "var(--status-positive)"
                        : liquidationRisk === "medium"
                        ? "var(--status-warning)"
                        : "var(--status-negative)",
                    }}
                  >
                    {dn.format(dn.mul(ltv, 100), 2)}%
                  </div>
                </div>
              }
              end={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {liquidationRisk === "low" ? "Low" : liquidationRisk === "medium" ? "Medium" : "High"}{" "}
                    liquidation risk
                  </div>
                  <StatusDot
                    mode={riskLevelToStatusMode(liquidationRisk)}
                    size={8}
                  />
                </div>
              }
            />
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Interest rate
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(dn.mul(interestRate, 100), 2)}%
                  </div>
                </div>
              }
              end={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {redemptionRisk === "low" ? "Low" : redemptionRisk === "medium" ? "Medium" : "High"} redemption risk
                  </div>
                  <StatusDot
                    mode={riskLevelToStatusMode(redemptionRisk)}
                    size={8}
                  />
                </div>
              }
            />
          </CardRows>
        }
      />
    </Link>
  );
}

function PositionLeverage({
  borrowed,
  collateral,
  deposit,
  interestRate,
  troveId,
}: Pick<
  PositionLeverage,
  | "borrowed"
  | "collateral"
  | "deposit"
  | "interestRate"
  | "troveId"
>) {
  const token = TOKENS_BY_SYMBOL[collateral];
  const collateralPriceUsd = usePrice(token.symbol);

  if (!collateralPriceUsd) {
    return null;
  }

  const ltv = dn.div(borrowed, dn.mul(deposit, collateralPriceUsd));
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = getLiquidationRisk(ltv, maxLtv);

  const price = usePrice(token.symbol);
  const totalValue = price && dn.mul(deposit, price);
  return (
    <Link
      href={`/loan?id=${troveId}`}
      legacyBehavior
      passHref
    >
      <StrongCard
        heading={[
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt",
              })}
            >
              <IconBorrow size={16} />
            </div>
            Leverage position
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              {totalValue ? dn.format(totalValue, 2) : "−"}
              <TokenIcon
                size={24}
                symbol="BOLD"
              />
            </HFlex>
          ),
          label: "Net value",
        }}
        secondary={
          <CardRows>
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    LTV
                  </div>
                  <div
                    className={css({
                      "--status-positive": "token(colors.positiveAlt)",
                      "--status-warning": "token(colors.warning)",
                      "--status-negative": "token(colors.negative)",
                    })}
                    style={{
                      color: liquidationRisk === "low"
                        ? "var(--status-positive)"
                        : liquidationRisk === "medium"
                        ? "var(--status-warning)"
                        : "var(--status-negative)",
                    }}
                  >
                    {dn.format(dn.mul(ltv, 100), 2)}%
                  </div>
                </div>
              }
              end={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {liquidationRisk === "low" ? "Low" : liquidationRisk === "medium" ? "Medium" : "High"}{" "}
                    liquidation risk
                  </div>
                  <StatusDot
                    mode={riskLevelToStatusMode(liquidationRisk)}
                    size={8}
                  />
                </div>
              }
            />
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Interest rate
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(dn.mul(interestRate, 100), 2)}%
                  </div>
                </div>
              }
              end={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {redemptionRisk === "low" ? "Low" : redemptionRisk === "medium" ? "Medium" : "High"} redemption risk
                  </div>
                  <StatusDot
                    mode={riskLevelToStatusMode(redemptionRisk)}
                    size={8}
                  />
                </div>
              }
            />
          </CardRows>
        }
      />
    </Link>
  );
}

function PositionEarn({
  apr,
  collateral,
  deposit,
  rewards,
}: Pick<
  PositionEarn,
  | "apr"
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
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt",
              })}
            >
              <IconBorrow size={16} />
            </div>
            Earn position
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              +{dn.format(rewards.bold, 2)}
              <TokenIcon
                size={24}
                symbol="BOLD"
              />
            </HFlex>
          ),
          label: (
            <HFlex gap={4} justifyContent="flex-start">
              <span>+{dn.format(rewards.eth, 4)}</span>
              <TokenIcon
                size="small"
                symbol={token.symbol}
              />
            </HFlex>
          ),
        }}
        secondary={
          <CardRows>
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Current APR
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(dn.mul(apr, 100), 2)}%
                  </div>
                </div>
              }
            />
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Deposit
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(deposit, 4)} BOLD
                  </div>
                </div>
              }
            />
          </CardRows>
        }
      />
    </Link>
  );
}

function PositionStake({
  deposit,
  rewards,
}: Pick<
  PositionStake,
  | "deposit"
  | "rewards"
>) {
  const votingPower = dn.div(rewards.lusd, LQTY_SUPPLY);
  return (
    <Link
      href="/stake"
      legacyBehavior
      passHref
    >
      <StrongCard
        heading={[
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt",
              })}
            >
              <IconStake size={16} />
            </div>
            LQTY stake
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              +{dn.format(rewards.lusd, 2)}
              <TokenIcon
                size={24}
                symbol="LUSD"
              />
            </HFlex>
          ),
          label: (
            <HFlex gap={4} justifyContent="flex-start">
              <span>+{dn.format(rewards.eth, 4)}</span>
              <TokenIcon
                size="small"
                symbol="ETH"
              />
            </HFlex>
          ),
        }}
        secondary={
          <CardRows>
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Voting power
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(dn.mul(votingPower, 100), 4)}%
                  </div>
                </div>
              }
            />
            <CardRow
              start={
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Deposit
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
                    })}
                  >
                    {dn.format(deposit, 2)} LQTY
                  </div>
                </div>
              }
            />
          </CardRows>
        }
      />
    </Link>
  );
}

function EditSquare() {
  return (
    <div
      className={css({
        display: "grid",
        placeItems: "center",
        width: 32,
        height: 32,
        color: "#F0F3FE",
        background: "rgba(247, 247, 255, 0.1)",
        borderRadius: 8,
      })}
    >
      <IconEdit size={24} />
    </div>
  );
}

function CardRows({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
      })}
    >
      {children}
    </div>
  );
}

function CardRow({
  start,
  end,
}: {
  start?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        color: "strongSurfaceContent",
      })}
    >
      {start}
      {end}
    </div>
  );
}
