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
  IconEarn,
  IconEdit,
  IconLeverage,
  IconStake,
  StatusDot,
  StrongCard,
  TokenIcon,
  TOKENS_BY_SYMBOL,
} from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import Link from "next/link";
import { match } from "ts-pattern";

export function Positions() {
  const account = useAccount();

  const positionCards = ACCOUNT_POSITIONS.map((position, index) => (
    match(position)
      .with({ type: "loan" }, ({ type, ...props }) => [index, <PositionLoan {...props} />])
      .with({ type: "earn" }, ({ type, ...props }) => [index, <PositionEarn {...props} />])
      .with({ type: "leverage" }, ({ type, ...props }) => [index, <PositionLeverage {...props} />])
      .with({ type: "stake" }, ({ type, ...props }) => [index, <PositionStake {...props} />])
      .exhaustive()
  ));

  const mode = account.isConnected && positionCards.length > 0 ? "positions" : "actions";

  const actionCards = [
    <ActionCard type="borrow" />,
    <ActionCard type="leverage" />,
    <ActionCard type="earn" />,
    <ActionCard type="stake" />,
  ].map((card, index) => [index, card]);

  const positionTransitions = useTransition(mode === "positions" ? positionCards : actionCards, {
    keys: ([index]) => `${index}${mode}`,
    from: { opacity: 0, transform: "scale3d(0.95, 0.95, 1)" },
    enter: { opacity: 1, transform: "scale3d(1, 1, 1)" },
    leave: { display: "none", immediate: true },
    trail: 10,
    config: {
      mass: 1,
      tension: 2800,
      friction: 80,
    },
  });

  return (
    <div>
      <h1
        className={css({
          fontSize: 32,
          color: "content",
        })}
        style={{
          paddingBottom: mode === "positions" ? 32 : 48,
        }}
      >
        {mode === "positions" ? content.home.myPositionsTitle : content.home.openPositionTitle}
      </h1>
      <div
        className={css({
          display: "grid",
          gap: 24,
        })}
        style={{
          gridTemplateColumns: `repeat(${mode === "positions" ? 3 : 4}, 1fr)`,
        }}
      >
        {positionTransitions((style, [_, card]) => (
          <a.div
            className={css({
              display: "grid",
              height: "100%",
            })}
            style={style}
          >
            {card}
          </a.div>
        ))}
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
                color: "strongSurfaceContentAlt2",
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
                color: "strongSurfaceContentAlt2",
              })}
            >
              <IconLeverage size={16} />
            </div>
            Leverage loan
          </div>,
        ]}
        contextual={<EditSquare />}
        main={{
          value: (
            <HFlex gap={8} alignItems="center" justifyContent="flex-start">
              {deposit ? dn.format(deposit, 2) : "−"}
              <TokenIcon
                size={24}
                symbol={token.symbol}
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
                color: "strongSurfaceContentAlt2",
              })}
            >
              <IconEarn size={16} />
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
                color: "strongSurfaceContentAlt2",
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
