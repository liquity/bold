import type { Address, PositionEarn, PositionLoan, PositionStake } from "@/src/types";
import type { ReactNode } from "react";

import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import { LQTY_SUPPLY } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import { formatLiquidationRisk, formatRedemptionRisk } from "@/src/formatting";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLtv, getRedemptionRisk } from "@/src/liquity-math";
import { useCollateral } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useEarnPositionsByAccount, useLoansByAccount } from "@/src/subgraph-hooks";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { sleep } from "@/src/utils";
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
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import Link from "next/link";
import { match } from "ts-pattern";
import { NewPositionCard } from "./NewPositionCard";

type Mode = "positions" | "loading" | "actions";

export function Positions({
  address,
  columns,
  showNewPositionCard = true,
  title = (mode) => (
    mode === "actions"
      ? content.home.openPositionTitle
      : content.home.myPositionsTitle
  ),
}: {
  address: null | Address;
  columns?: number;
  showNewPositionCard?: boolean;
  title?: (mode: Mode) => ReactNode;
}) {
  const loans = useLoansByAccount(address);
  const earnPositions = useEarnPositionsByAccount(address);

  const positions = useQuery({
    enabled: Boolean(address && !loans.isPending && !earnPositions.isPending),
    queryKey: ["CombinedPositions", address],
    queryFn: async () => {
      await sleep(300);
      if (DEMO_MODE) {
        return ACCOUNT_POSITIONS;
      }
      return [
        ...loans.data ?? [],
        ...earnPositions.data ?? [],
      ];
    },
  });

  const positionsPending = Boolean(
    address && (
      loans.isPending || earnPositions.isPending || positions.isPending
    ),
  );

  let mode: Mode = address && positions.data && positions.data.length > 0
    ? "positions"
    : positionsPending
    ? "loading"
    : "actions";

  const cards = match(mode)
    .returnType<Array<[number, ReactNode]>>()
    .with("positions", () => {
      const cards = positions.data?.map((position, index) => (
        match(position)
          .returnType<[number, ReactNode]>()
          .with({ type: "borrow" }, (props) => [index, <PositionBorrow {...props} />])
          .with({ type: "earn" }, (props) => [index, <PositionEarn {...props} />])
          .with({ type: "leverage" }, (props) => [index, <PositionLeverage {...props} />])
          .with({ type: "stake" }, (props) => [index, <PositionStake {...props} />])
          .exhaustive()
      )) ?? [];
      if (showNewPositionCard) {
        cards.push([positions.data?.length ?? -1, <NewPositionCard />]);
      }
      return cards;
    })
    .with("loading", () => [
      [0, <LoadingCard />],
      [1, <LoadingCard />],
      [2, <LoadingCard />],
    ])
    .otherwise(() => [
      [0, <ActionCard type="borrow" />],
      [1, <ActionCard type="leverage" />],
      [2, <ActionCard type="earn" />],
      [3, <ActionCard type="stake" />],
    ]);

  const positionTransitions = useTransition(cards, {
    keys: ([index]) => `${mode}${index}`,
    from: { opacity: 0, transform: "scale3d(0.97, 0.97, 1)" },
    enter: { opacity: 1, transform: "scale3d(1, 1, 1)" },
    leave: { display: "none", immediate: true },
    config: {
      mass: 2,
      tension: 1800,
      friction: 80,
    },
  });

  return (
    <PositionsGroup
      columns={columns}
      mode={mode}
      title={title}
    >
      {positionTransitions((style, [_, card]) => (
        <a.div
          className={css({
            display: "grid",
            height: "100%",
            willChange: "transform, opacity",
          })}
          style={style}
        >
          {card}
        </a.div>
      ))}
    </PositionsGroup>
  );
}

function PositionsGroup({
  children,
  columns = 3,
  mode,
  onTitleClick,
  title,
}: {
  children: ReactNode;
  columns?: number;
  mode: Mode;
  onTitleClick?: () => void;
  title: (mode: Mode) => ReactNode;
}) {
  const paddingBottom = mode === "actions" ? 48 : 32;
  const cardsHeight = mode === "actions" ? undefined : 185;
  const title_ = title(mode);

  return (
    <div>
      {title_ && (
        <h1
          className={css({
            fontSize: 32,
            color: "content",
            userSelect: "none",
          })}
          style={{
            paddingBottom,
          }}
          onClick={onTitleClick}
        >
          {title_}
        </h1>
      )}
      <div
        className={css({
          position: "relative",
        })}
        style={{
          minHeight: cardsHeight,
        }}
      >
        <div
          className={css({
            display: "grid",
            gap: 24,
          })}
          style={{
            gridTemplateColumns: `repeat(${mode === "actions" ? 4 : columns}, 1fr)`,
            gridAutoRows: cardsHeight,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function PositionBorrow({
  borrowed,
  collIndex,
  collateral,
  deposit,
  interestRate,
  troveId,
}: Pick<
  PositionLoan,
  | "borrowed"
  | "collIndex"
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

  const ltv = getLtv(deposit, borrowed, collateralPriceUsd);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);

  const title = [
    `Loan ID: ${troveId}`,
    `Borrowed: ${fmtnum(borrowed, "full")} BOLD`,
    `Collateral: ${fmtnum(deposit, "full")} ${token.name}`,
    `Interest rate: ${fmtnum(interestRate, "full", 100)}%`,
  ];

  return (
    <Link
      href={`/loan?id=${collIndex}:${troveId}`}
      legacyBehavior
      passHref
    >
      <StrongCard
        title={title.join("\n")}
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
              {fmtnum(borrowed)}
              <TokenIcon
                size={24}
                symbol="BOLD"
              />
            </HFlex>
          ),
          // label: "Total debt",
          label: (
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "cente",
              })}
            >
              Backed by {deposit ? dn.format(deposit, 2) : "−"} {token.name}
              <TokenIcon size="small" symbol={token.symbol} />
            </div>
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
                    LTV
                  </div>
                  {ltv && (
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
                  )}
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
                    {formatLiquidationRisk(liquidationRisk)}
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
  collIndex,
  collateral,
  deposit,
  interestRate,
  troveId,
}: Pick<
  PositionLoan,
  | "borrowed"
  | "collIndex"
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

  const ltv = getLtv(deposit, borrowed, collateralPriceUsd);
  const redemptionRisk = getRedemptionRisk(interestRate);

  const maxLtv = dn.from(1 / token.collateralRatio, 18);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);

  return (
    <Link
      href={`/loan?id=${collIndex}:${troveId}`}
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
                  {ltv && (
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
                  )}
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
                    {formatRedemptionRisk(redemptionRisk)}
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
  collIndex,
  deposit,
  rewards,
}: Pick<
  PositionEarn,
  | "apr"
  | "collIndex"
  | "deposit"
  | "rewards"
>) {
  const token = useCollateral(collIndex);
  return token && (
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
              <span>+{dn.format(rewards.coll, 4)}</span>
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

function LoadingCard() {
  return (
    <StrongCard
      loading={true}
      heading=""
      contextual=""
      secondary=""
    />
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
