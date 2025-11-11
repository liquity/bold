import type { Address, Position, PositionLoanUncommitted } from "@/src/types";
import type { ReactNode } from "react";

import { useBreakpointName } from "@/src/breakpoints";
import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import content from "@/src/content";
import { useWhiteLabelHeader } from "@/src/hooks/useWhiteLabel";
import { useEarnPositionsByAccount, useLoansByAccount } from "@/src/liquity-utils";
import { useSboldPosition } from "@/src/sbold";
import { css } from "@/styled-system/css";
import { a, useSpring, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import { NewPositionCard } from "./NewPositionCard";
import { PositionCard } from "./PositionCard";
import { PositionCardEarn } from "./PositionCardEarn";
import { PositionCardLoan } from "./PositionCardLoan";
import { PositionCardSbold } from "./PositionCardSbold";

type Mode = "positions" | "loading" | "actions";

// Move actionCards inside component to make it dynamic

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
  const headerConfig = useWhiteLabelHeader();
  
  // Dynamic action cards based on configuration
  const actionCards = [
    ...(headerConfig.navigation.showBorrow ? ["borrow" as const] : []),
    ...(headerConfig.navigation.showEarn ? ["earn" as const] : []),
  ];
  
  const loans = useLoansByAccount(address);
  const earnPositions = useEarnPositionsByAccount(address);
  const sboldPosition = useSboldPosition(address);

  const isPositionsPending = Boolean(
    address && (
      loans.isPending
      || earnPositions.isPending
      || sboldPosition.isPending
    ),
  );
  

  const hasSboldPosition = sboldPosition.data && dn.gt(sboldPosition.data.sbold, 0);

  const positions = isPositionsPending ? [] : [
    ...(loans.data ?? []),
    ...(earnPositions.data ?? []),
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
      actionCards={actionCards}
    />
  );
}

function PositionsGroup({
  columns,
  mode,
  positions,
  title,
  showNewPositionCard,
  actionCards,
}: {
  columns?: number;
  mode: Mode;
  positions: Exclude<Position, PositionLoanUncommitted>[];
  title: (mode: Mode) => ReactNode;
  showNewPositionCard: boolean;
  actionCards: readonly ("borrow" | "earn" | "multiply")[];
}) {
  columns ??= (mode === "actions" || mode === "loading") ? actionCards.length : 3;

  const title_ = title(mode);

  const cards = match(mode)
    .returnType<Array<[number, ReactNode]>>()
    .with("positions", () => {
      let cards: Array<[number, ReactNode]> = [];

      if (showNewPositionCard) {
        cards.push([positions.length ?? -1, <NewPositionCard key="new" />]);
      }

      cards = cards.concat(
        positions.map((position, index) => (
          match(position)
            .returnType<[number, ReactNode]>()
            .with({ type: P.union("borrow", "multiply") }, (p) => [
              index,
              <PositionCardLoan key={index} {...p} />,
            ])
            .with({ type: "earn" }, (p) => [
              index,
              <PositionCardEarn key={index} {...p} />,
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
    .with("loading", () => 
      // Generate loading skeletons based on actionCards length
      Array.from({ length: actionCards.length }, (_, index) => [
        index, 
        <PositionCard key={index} loading />
      ])
    )
    .with("actions", () => (
      (showNewPositionCard ? actionCards : []).map((type, index) => [
        index,
        <ActionCard key={index} type={type} />,
      ])
    ))
    .exhaustive();

  const breakpoint = useBreakpointName();

  const cardHeight = mode === "actions" ? 144 : 180;
  const rows = Math.ceil(cards.length / columns);
  const containerHeight = cardHeight * rows + (breakpoint === "small" ? 16 : 24) * (rows - 1);

  const positionTransitions = useTransition(cards, {
    keys: ([index]) => `${mode}${index}`,
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
  });

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
              base: 30,
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
    </div>
  );
}
