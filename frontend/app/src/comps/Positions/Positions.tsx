import type { Address } from "@/src/types";
import type { ReactNode } from "react";

import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import content from "@/src/content";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import { useEarnPositionsByAccount, useLoansByAccount } from "@/src/subgraph-hooks";
import { sleep } from "@/src/utils";
import { css } from "@/styled-system/css";
import { StrongCard } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { useQuery } from "@tanstack/react-query";
import { match } from "ts-pattern";
import { NewPositionCard } from "./NewPositionCard";
import { PositionCardBorrow } from "./PositionCardBorrow";
import { PositionCardEarn } from "./PositionCardEarn";
import { PositionCardLeverage } from "./PositionCardLeverage";
import { PositionCardStake } from "./PositionCardStake";

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
          .with({ type: "borrow" }, (p) => [index, <PositionCardBorrow {...p} />])
          .with({ type: "earn" }, (p) => [index, <PositionCardEarn {...p} />])
          .with({ type: "leverage" }, (p) => [index, <PositionCardLeverage {...p} />])
          .with({ type: "stake" }, (p) => [index, <PositionCardStake {...p} />])
          .exhaustive()
      )) ?? [];
      if (showNewPositionCard) {
        cards.push([positions.data?.length ?? -1, <NewPositionCard />]);
      }
      return cards;
    })
    .with("loading", () => [
      [0, <StrongCard loading />],
      [1, <StrongCard loading />],
      [2, <StrongCard loading />],
    ])
    .with("actions", () => [
      [0, <ActionCard type="borrow" />],
      [1, <ActionCard type="leverage" />],
      [2, <ActionCard type="earn" />],
      [3, <ActionCard type="stake" />],
    ])
    .exhaustive();

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
