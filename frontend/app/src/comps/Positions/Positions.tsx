import type { Address, BranchId, Position, PositionLoanCommitted, PositionLoanUncommitted } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { useBreakpointName } from "@/src/breakpoints";
import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import { ManualLoanIdInput } from "@/src/comps/ManualLoanIdInput";
import content from "@/src/content";
import { subgraphIndicator } from "@/src/indicators/subgraph-indicator";
import { useEarnPositionsByAccount, useLoansByAccount, useStakePosition } from "@/src/liquity-utils";
import {
  getBranches,
  useCollateralSurplusByBranches,
  useEarnPositionsByAccount,
  useLoansByAccount,
  useStakePosition,
} from "@/src/liquity-utils";
import { useSboldPosition } from "@/src/sbold";
import { isPositionLoan } from "@/src/types";
import { css } from "@/styled-system/css";
import { IconChevronSmallUp } from "@liquity2/uikit";
import { a, useSpring, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import { NewPositionCard } from "./NewPositionCard";
import { PositionCard } from "./PositionCard";
import { PositionCardEarn } from "./PositionCardEarn";
import { PositionCardLoan } from "./PositionCardLoan";
import { PositionCardSbold } from "./PositionCardSbold";
import { PositionCardStake } from "./PositionCardStake";

type Mode = "positions" | "loading" | "actions";

const actionCards = [
  "borrow",
  "multiply",
  "earn",
  "stake",
] as const;

const branchIds = getBranches().map((b) => b.branchId);

export function Positions({
  address,
  columns,
  showNewPositionCard = true,
  title = (mode) => (
    mode === "loading"
      ? " "
      : mode === "positions"
      ? content.home.myPositionsTitle
      : content.home.openPositionTitle
  ),
}: {
  address: null | Address;
  columns?: number;
  showNewPositionCard?: boolean;
  title?: (mode: Mode) => ReactNode;
}) {
  const loans = useLoansByAccount(address);
  const earnPositions = useEarnPositionsByAccount(address);
  const sboldPosition = useSboldPosition(address);
  const stakePosition = useStakePosition(address, "v2");
  const collSurplusQueries = useCollateralSurplusByBranches(address, branchIds);

  const collSurplusMap = useMemo(() => {
    if (!collSurplusQueries.data) return null;

    const map = new Map<BranchId, dn.Dnum>();
    for (const item of collSurplusQueries.data) {
      map.set(item.branchId, item.surplus);
    }
    return map;
  }, [collSurplusQueries.data]);

  const isPositionsPending = Boolean(
    address && (
      loans.isPending
      || earnPositions.isPending
      || sboldPosition.isPending
      || stakePosition.isPending
      || !collSurplusMap
    ),
  );

  const hasStakePosition = stakePosition.data && dn.gt(stakePosition.data.deposit, 0);
  const hasSboldPosition = sboldPosition.data && dn.gt(sboldPosition.data.sbold, 0);

  const positions = isPositionsPending ? [] : [
    ...(loans.data ?? []),
    ...(earnPositions.data ?? []),
    ...(stakePosition.data && hasStakePosition ? [stakePosition.data] : []),
    ...(sboldPosition.data && hasSboldPosition ? [sboldPosition.data] : []),
  ];

  let mode: Mode = address && positions && positions.length > 0
    ? "positions"
    : isPositionsPending
    ? "loading"
    : "actions";

  // preloading for 1 second, prevents flickering
  // since the account doesn’t reconnect instantly
  const [preLoading, setPreLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (preLoading) {
    mode = "loading";
  }

  const breakpoint = useBreakpointName();

  return (
    <PositionsGroup
      columns={breakpoint === "small"
        ? 1
        : breakpoint === "medium"
        ? 2
        : columns}
      mode={mode}
      positions={positions ?? []}
      showNewPositionCard={showNewPositionCard}
      title={title}
      collSurplusMap={collSurplusMap}
    />
  );
}

function PositionsGroup({
  columns,
  mode,
  positions,
  title,
  showNewPositionCard,
  collSurplusMap,
}: {
  columns?: number;
  mode: Mode;
  positions: Exclude<Position, PositionLoanUncommitted>[];
  title: (mode: Mode) => ReactNode;
  showNewPositionCard: boolean;
  collSurplusMap: Map<BranchId, Dnum> | null;
}) {
  columns ??= mode === "actions" ? actionCards.length : 3;

  const title_ = title(mode);
  const [isLiquidatedExpanded, setIsLiquidatedExpanded] = useState(false);

  const toggleLiquidatedExpanded = useCallback(() => {
    setIsLiquidatedExpanded(!isLiquidatedExpanded);
  }, [isLiquidatedExpanded]);

  const { activePositions, liquidatedPositions } = useMemo(() => {
    const active: Position[] = [];
    const liquidated: PositionLoanCommitted[] = [];

    for (const position of positions) {
      if (isPositionLoan(position) && position.status === "liquidated") {
        liquidated.push(position);
      } else {
        active.push(position);
      }
    }

    return { activePositions: active, liquidatedPositions: liquidated };
  }, [positions]);

  const { liquidatedWithClaimable, liquidatedWithoutClaimable } = useMemo(() => {
    const withClaimable: PositionLoanCommitted[] = [];
    const withoutClaimable: PositionLoanCommitted[] = [];

    if (!collSurplusMap) {
      return { liquidatedWithClaimable: withClaimable, liquidatedWithoutClaimable: withoutClaimable };
    }

    for (const position of liquidatedPositions) {
      const surplus = collSurplusMap.get(position.branchId);
      if (surplus && dn.gt(surplus, 0)) {
        withClaimable.push(position);
      } else {
        withoutClaimable.push(position);
      }
    }

    return { liquidatedWithClaimable: withClaimable, liquidatedWithoutClaimable: withoutClaimable };
  }, [liquidatedPositions, collSurplusMap]);

  const topLevelPositions = useMemo(
    () => [...activePositions, ...liquidatedWithClaimable],
    [activePositions, liquidatedWithClaimable],
  );

  const cards = match(mode)
    .returnType<Array<[number, ReactNode]>>()
    .with("positions", () => {
      let cards: Array<[number, ReactNode]> = [];

      if (showNewPositionCard) {
        cards.push([topLevelPositions.length ?? -1, <NewPositionCard key="new" />]);
      }

      cards = cards.concat(
        topLevelPositions.map((position, index) => (
          match(position)
            .returnType<[number, ReactNode]>()
            .with({ type: P.union("borrow", "multiply") }, (p) => {
              if (p.troveId !== null) {
                return [
                  index,
                  <PositionCardLoan
                    key={index}
                    {...p}
                    collSurplusOnChain={collSurplusMap?.get(p.branchId) ?? null}
                  />,
                ];
              }
              return [index, null];
            })
            .with({ type: "earn" }, (p) => [
              index,
              <PositionCardEarn key={index} {...p} />,
            ])
            .with({ type: "stake" }, (p) => [
              index,
              <PositionCardStake key={index} {...p} />,
            ])
            .with({ type: "sbold" }, (p) => [
              index,
              <PositionCardSbold key={index} {...p} />,
            ])
            .exhaustive()
        )) ?? [],
      );

      return cards;
    })
    .with("loading", () => [
      [0, <PositionCard key="0" loading />],
      [1, <PositionCard key="1" loading />],
      [2, <PositionCard key="2" loading />],
    ])
    .with("actions", () => (
      (showNewPositionCard ? actionCards : []).map((type, index) => [
        index,
        <ActionCard key={index} type={type} />,
      ])
    ))
    .exhaustive();

  const liquidatedCards = liquidatedWithoutClaimable.map((position, index) => {
    return [
      index,
      <PositionCardLoan
        key={`liquidated-${index}`}
        {...position}
        collSurplusOnChain={collSurplusMap?.get(position.branchId) ?? null}
      />,
    ] as [number, ReactNode];
  });

  const breakpoint = useBreakpointName();

  const cardHeight = mode === "actions" ? 144 : 180;
  const rows = Math.ceil(cards.length / columns);
  const containerHeight = cardHeight * rows + (breakpoint === "small" ? 16 : 24) * (rows - 1);

  const TRANSITION_CONFIG = {
    from: {
      display: "none",
      opacity: 0,
      transform: "scale(0.9)",
    },
    enter: {
      display: "grid",
      opacity: 1,
      transform: "scale(1)",
    },
    leave: {
      display: "none",
      opacity: 0,
      transform: "scale(1)",
      immediate: true,
    },
    config: {
      mass: 1,
      tension: 1600,
      friction: 120,
    },
  };

  function usePositionCardTransitions(
    cards: Array<[number, ReactNode]>,
    keyPrefix: string,
  ) {
    return useTransition(cards, {
      keys: ([index]) => `${keyPrefix}${index}`,
      ...TRANSITION_CONFIG,
    });
  }

  const positionTransitions = usePositionCardTransitions(cards, mode);

  const animateHeight = useRef(false);
  if (mode === "loading") {
    animateHeight.current = true;
  }

  const containerSpring = useSpring({
    initial: { height: cardHeight },
    from: { height: cardHeight },
    to: { height: containerHeight },
    immediate: !animateHeight.current || mode === "loading",
    config: {
      mass: 1,
      tension: 2400,
      friction: 100,
    },
  });

  const liquidatedRows = Math.ceil(liquidatedCards.length / columns);
  const liquidatedContainerHeight = 180 * liquidatedRows
    + (breakpoint === "small" ? 16 : 24) * (liquidatedRows - 1);

  const liquidatedTransitions = usePositionCardTransitions(liquidatedCards, "liquidated");

  return (
    <div>
      {title_ && (
        <h1
          className={css({
            fontSize: {
              base: 24,
              medium: 26,
              large: 32,
            },
            paddingBottom: {
              base: 16,
              medium: 20,
              large: 32,
            },
            color: "content",
            userSelect: "none",
          })}
        >
          {title_}
        </h1>
      )}
      {subgraphIndicator.hasError() && <ManualLoanIdInput />}

      <a.div
        className={css({
          position: "relative",
        })}
        style={{
          ...containerSpring,
        }}
      >
        <a.div
          className={css({
            display: "grid",
            gap: {
              base: 16,
              medium: 24,
            },
          })}
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gridAutoRows: cardHeight,
          }}
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
        </a.div>
      </a.div>
      {liquidatedCards.length > 0 && (
        <div
          className={css({
            marginTop: {
              base: 12,
              medium: 20,
              large: 28,
            },
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            })}
          >
            <button
              onClick={toggleLiquidatedExpanded}
              className={css({
                fontSize: {
                  base: 20,
                  medium: 22,
                  large: 24,
                },
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                _hover: {
                  opacity: 0.8,
                },
                _focusVisible: {
                  borderRadius: 2,
                  outline: "2px solid token(colors.focused)",
                  outlineOffset: 1,
                },
              })}
            >
              <span
                className={css({
                  color: "content",
                  userSelect: "none",
                  fontSize: "16",
                })}
              >
                {isLiquidatedExpanded
                  ? "Click to hide My Liquidated Positions"
                  : "Click to view My Liquidated Positions"}
              </span>
            </button>
            <button
              onClick={toggleLiquidatedExpanded}
              className={css({
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                _hover: {
                  opacity: 0.8,
                },
                _focusVisible: {
                  borderRadius: 2,
                  outline: "2px solid token(colors.focused)",
                  outlineOffset: 1,
                },
              })}
            >
              <span
                className={css({
                  color: "contentAlt",
                  transition: "transform 0.15s ease",
                  transform: isLiquidatedExpanded ? "rotate(0deg)" : "rotate(180deg)",
                  display: "flex",
                  alignItems: "center",
                })}
              >
                <IconChevronSmallUp size={16} />
              </span>
            </button>
          </div>
          {isLiquidatedExpanded && (
            <>
              <a.div
                className={css({
                  position: "relative",
                  marginTop: 16,
                })}
                style={{
                  height: liquidatedContainerHeight,
                }}
              >
                <a.div
                  className={css({
                    display: "grid",
                    gap: {
                      base: 16,
                      medium: 24,
                    },
                  })}
                  style={{
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gridAutoRows: 180,
                  }}
                >
                  {liquidatedTransitions((style, [_, card]) => (
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
                </a.div>
              </a.div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
