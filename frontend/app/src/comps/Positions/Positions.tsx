import type { Address, CollIndex, Position, PositionLoanUncommitted } from "@/src/types";
import type { ReactNode } from "react";

import { ActionCard } from "@/src/comps/ActionCard/ActionCard";
import content from "@/src/content";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
// import { useStakePosition } from "@/src/liquity-utils";
import {
  // useEarnPositionsByAccount,
  useLoansByAccount,
} from "@/src/subgraph-hooks";
import { useEarnPositionsByAccount, useEarnPools } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { a, useSpring, useTransition } from "@react-spring/web";
// import * as dn from "dnum";
import { useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import { NewPositionCard } from "./NewPositionCard";
import { PositionCard } from "./PositionCard";
import { PositionCardEarn } from "./PositionCardEarn";
import { PositionCardLoan } from "./PositionCardLoan";
import { PositionCardStake } from "./PositionCardStake";
import { PositionCardYusnd } from "./PositionCardYusnd";
import { SortButton, type SortField } from "./SortButton";
import { HFlex } from "@liquity2/uikit";
import { useYusndPosition } from "@/src/yusnd";
import * as dn from "dnum";


type Mode = "positions" | "loading" | "actions";

export function Positions({
  address,
  columns,
  showNewPositionCard = true,
  title = (mode) =>
    mode === "loading"
      ? " "
      : mode === "positions"
      ? content.home.myPositionsTitle
      : content.home.openPositionTitle,
}: {
  address: null | Address;
  columns?: number;
  showNewPositionCard?: boolean;
  title?: (mode: Mode) => ReactNode;
}) {
  const loans = useLoansByAccount(address);
  const earnPositions = useEarnPositionsByAccount(address);
  const yusndPosition = useYusndPosition(address);
  // const stakePosition = useStakePosition(address);

  const [sortBy, setSortBy] = useState<SortField>("default");

  const isPositionsPending = Boolean(
    address &&
      (
        loans.isPending 
        || earnPositions.isPending 
        || yusndPosition.isPending
        // || stakePosition.isPending
      )
  );

  const positions = isPositionsPending
    ? []
    : DEMO_MODE
    ? ACCOUNT_POSITIONS
    : [
        ...(loans.data ?? []),
        ...(earnPositions.data?.filter(pos => pos.collIndex !== null)
          .map(pos => ({
            ...pos,
            collIndex: pos.collIndex!
          })) ?? []),
        ...(yusndPosition.data && dn.gt(yusndPosition.data.yusnd, 0) ? [yusndPosition.data] : []),
        // ...(stakePosition.data && dn.gt(stakePosition.data.deposit, 0)
        //   ? [stakePosition.data]
        //   : []),
      ];

  const earnCollIndices = [...new Set(
    positions
      .filter(p => p.type === "earn")
      .map(p => {
        if (p.type === "earn" && 'collIndex' in p && p.collIndex != null) {
          return p.collIndex;
        }
        return null;
      })
      .filter((index): index is CollIndex => index !== null)
  )];
  
  const poolsQuery = useEarnPools(earnCollIndices);
  const poolsData = poolsQuery.data || {};

  const positionsWithPoolData = positions.map(pos => {
    if (pos.type === "earn" && pos.collIndex != null && poolsData[pos.collIndex]) {
      return { ...pos, poolData: poolsData[pos.collIndex] };
    }
    return pos;
  });

  const sortedPositions = [...positionsWithPoolData].sort((a, b) => {
    const getDeposit = (pos: any) => {
      if (pos.type === "earn" || pos.type === "stake" || pos.type === "yusnd") {
        return Number(pos.deposit?.[0] ?? 0n);
      }
      if (pos.type === "borrow" || pos.type === "multiply") {
        return Number(pos.deposit?.[0] ?? 0n);
      }
      return 0;
    };
    
    const getDebt = (pos: any) => {
      if (pos.type === "borrow" || pos.type === "multiply") {
        return Number(pos.borrowed?.[0] ?? 0n);
      }
      return 0;
    };
    
    const getAvgRate = (pos: any) => {
      if ((pos.type === "borrow" || pos.type === "multiply") && pos.interestRate) {
        return Number(pos.interestRate[0] ?? 0n);
      }
      return 0;
    };
    
    const getAPR = (pos: any) => {
      if (pos.type === "earn" && pos.poolData?.apr?.[0] != null) {
        return Number(pos.poolData.apr[0]);
      }
      return 0;
    };
    
    const getAPR7d = (pos: any) => {
      if (pos.type === "earn" && pos.poolData?.apr7d?.[0] != null) {
        return Number(pos.poolData.apr7d[0]);
      }
      return 0;
    };
    
    const getPoolSize = (pos: any) => {
      if (pos.type === "earn" && pos.poolData?.totalDeposited?.[0] != null) {
        return Number(pos.poolData.totalDeposited[0]);
      }
      return 0;
    };
    
    switch (sortBy) {
      case "default":
        // For positions without collIndex (like stake), put them at the end
        const aCollIndex = 'collIndex' in a ? Number(a.collIndex) : 999;
        const bCollIndex = 'collIndex' in b ? Number(b.collIndex) : 999;
        return aCollIndex - bCollIndex;
      case "apr-asc":
        return getAPR(a) - getAPR(b);
      case "apr-desc":
        return getAPR(b) - getAPR(a);
      case "apr7d-asc":
        return getAPR7d(a) - getAPR7d(b);
      case "apr7d-desc":
        return getAPR7d(b) - getAPR7d(a);
      case "poolSize-asc":
        return getPoolSize(a) - getPoolSize(b);
      case "poolSize-desc":
        return getPoolSize(b) - getPoolSize(a);
      case "avgRate-asc":
        return getAvgRate(a) - getAvgRate(b);
      case "avgRate-desc":
        return getAvgRate(b) - getAvgRate(a);
      case "deposited-asc":
        return getDeposit(a) - getDeposit(b);
      case "deposited-desc":
        return getDeposit(b) - getDeposit(a);
      case "debt-asc":
        return getDebt(a) - getDebt(b);
      case "debt-desc":
        return getDebt(b) - getDebt(a);
      default:
        return 0;
    }
  });

  let mode: Mode =
    address && positions && positions.length > 0
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

  return (
    <PositionsGroup
      columns={columns}
      mode={mode}
      positions={sortedPositions ?? []}
      showNewPositionCard={showNewPositionCard}
      title={title}
      sortBy={sortBy}
      setSortBy={setSortBy}
    />
  );
}

function PositionsGroup({
  // columns = 4,
  columns = 3,
  mode,
  onTitleClick,
  positions,
  title,
  showNewPositionCard,
  sortBy,
  setSortBy,
}: {
  columns?: number;
  mode: Mode;
  onTitleClick?: () => void;
  positions: Exclude<Position, PositionLoanUncommitted>[];
  title: (mode: Mode) => ReactNode;
  showNewPositionCard: boolean;
  sortBy: SortField;
  setSortBy: (sortBy: SortField) => void;
}) {
  const title_ = title(mode);
  
  const handleSortClick = (field: string) => {
    const currentField = sortBy.replace("-asc", "").replace("-desc", "");
    const isAsc = sortBy.endsWith("-asc");
    
    if (field === "default") {
      setSortBy("default");
    } else if (currentField === field) {
      setSortBy(`${field}-${isAsc ? "desc" : "asc"}` as SortField);
    } else {
      setSortBy(`${field}-desc` as SortField);
    }
  };

  const cards = match(mode)
    .returnType<Array<[number, ReactNode]>>()
    .with("positions", () => {
      let cards: Array<[number, ReactNode]> = [];

      if (showNewPositionCard) {
        cards.push([positions.length ?? -1, <NewPositionCard key='new' />]);
      }

      cards = cards.concat(
        positions.map((position, index) =>
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
            .with({ type: "stake" }, (p) => [
              index,
              <PositionCardStake key={index} {...p} />,
            ])
            .with({ type: "yusnd" }, (p) => [
              index,
              <PositionCardYusnd key={index} {...p} />,
            ])
            .exhaustive()
        ) ?? []
      );

      return cards;
    })
    .with("loading", () => [
      [0, <PositionCard key='0' loading />],
      [1, <PositionCard key='1' loading />],
      [2, <PositionCard key='2' loading />],
      // [3, <PositionCard key='3' loading />],
    ])
    .with("actions", () =>
      showNewPositionCard
        ? [
            // [0, <ActionCard key='0' type='borrow' />],
            // [1, <ActionCard key='1' type='multiply' />],
            // [2, <ActionCard key='2' type='earn' />],
            // [3, <ActionCard key='3' type='buy' />],
            [0, <ActionCard key='0' type='borrow' />],
            [1, <ActionCard key='1' type='earn' />],
            [2, <ActionCard key='2' type='stream' />],
            // [2, <ActionCard key='3' type='buy' />],
          ]
        : []
    )
    .exhaustive();

  if (mode === "actions") {
    // columns = 4;
    columns = 3;
  }

  const cardHeight = mode === "actions" ? 144 : 180;
  const rows = Math.ceil(cards.length / columns);
  const containerHeight = cardHeight * rows + 24 * (rows - 1);

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
        <div className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 32,
        })}>
          <h1
            className={css({
              fontSize: 32,
              color: "content",
              userSelect: "none",
            })}
            onClick={onTitleClick}
          >
            {title_}
          </h1>
          {positions.length > 0 && (() => {
            const hasEarnPositions = positions.some(p => p.type === "earn");
            const hasLoanPositions = positions.some(p => p.type === "borrow" || p.type === "multiply");
            const hasDepositPositions = positions.some(p => p.type === "earn" || p.type === "stake" || p.type === "yusnd");
            
            return (
              <HFlex gap={8} alignItems="center">
                <p className={css({
                  fontSize: 14,
                  color: "contentAlt",
                })}>Sort by:</p>
                <div className={css({
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                })}>
                  <SortButton 
                    label="Default" 
                    isActive={sortBy === "default"}
                    onClick={() => handleSortClick("default")}
                  />
                  <SortButton 
                    label="APR" 
                    field="apr"
                    sortBy={sortBy}
                    disabled={!hasEarnPositions}
                    disabledTooltip={!hasEarnPositions ? "APR sorting is only available when you have earn positions" : undefined}
                    onClick={() => handleSortClick("apr")}
                  />
                  <SortButton 
                    label="7d APR" 
                    field="apr7d"
                    sortBy={sortBy}
                    disabled={!hasEarnPositions}
                    disabledTooltip={!hasEarnPositions ? "7d APR sorting is only available when you have earn positions" : undefined}
                    onClick={() => handleSortClick("apr7d")}
                  />
                  <SortButton 
                    label="Pool size" 
                    field="poolSize"
                    sortBy={sortBy}
                    disabled={!hasEarnPositions}
                    disabledTooltip={!hasEarnPositions ? "Pool size sorting is only available when you have earn positions" : undefined}
                    onClick={() => handleSortClick("poolSize")}
                  />
                  <SortButton 
                    label="Avg rate, p.a." 
                    field="avgRate"
                    sortBy={sortBy}
                    disabled={!hasLoanPositions}
                    disabledTooltip={!hasLoanPositions ? "Average rate sorting is only available when you have loan positions" : undefined}
                    onClick={() => handleSortClick("avgRate")}
                  />
                  <SortButton 
                    label="Debt" 
                    field="debt"
                    sortBy={sortBy}
                    disabled={!hasLoanPositions}
                    disabledTooltip={!hasLoanPositions ? "Debt sorting is only available when you have loan positions" : undefined}
                    onClick={() => handleSortClick("debt")}
                  />
                  <SortButton 
                    label={hasLoanPositions ? "Deposited/Collateral" : "Deposited"} 
                    field="deposited"
                    sortBy={sortBy}
                    disabled={!hasDepositPositions}
                    disabledTooltip={!hasDepositPositions ? "Deposit sorting is only available when you have positions with deposits" : undefined}
                    onClick={() => handleSortClick("deposited")}
                  />
                </div>
              </HFlex>
            );
          })()}
        </div>
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
            gap: 24,
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
