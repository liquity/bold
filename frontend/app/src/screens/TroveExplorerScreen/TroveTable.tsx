import type { TroveExplorerItem } from "@/src/types";

import { getLiquidationPrice, getLtv } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import * as dn from "dnum";
import { useMemo } from "react";
import { TroveRow } from "./TroveRow";

type Props = {
  troves: TroveExplorerItem[];
  isLoading: boolean;
  orderBy: string;
  orderDirection: "asc" | "desc";
  onSort: (field: string) => void;
};

// Client-side sortable fields (computed from prices)
const CLIENT_SORT_FIELDS = new Set(["collateralValue", "liqPrice", "ltv"]);

function useAllPrices() {
  // Always call usePrice for every symbol — hook count is constant
  const eth = usePrice("ETH");
  const wsteth = usePrice("WSTETH");
  const reth = usePrice("RETH");
  const weeth = usePrice("WEETH");
  const arb = usePrice("ARB");
  const comp = usePrice("COMP");
  const tbtc = usePrice("TBTC");

  return useMemo(() => {
    const map = new Map<string, readonly [bigint, number] | null>();
    const queries = [
      ["ETH", eth], ["WSTETH", wsteth], ["RETH", reth],
      ["WEETH", weeth], ["ARB", arb], ["COMP", comp], ["TBTC", tbtc],
    ] as const;
    for (const [sym, q] of queries) {
      map.set(sym, q.data ?? null);
    }
    return map;
  }, [eth.data, wsteth.data, reth.data, weeth.data, arb.data, comp.data, tbtc.data]);
}

export function TroveTable({
  troves,
  isLoading,
  orderBy,
  orderDirection,
  onSort,
}: Props) {
  const priceMap = useAllPrices();

  // Client-side sort for computed fields
  const sortedTroves = useMemo(() => {
    if (!CLIENT_SORT_FIELDS.has(orderBy)) return troves;

    return [...troves].sort((a, b) => {
      const priceA = priceMap.get(a.collateralSymbol);
      const priceB = priceMap.get(b.collateralSymbol);

      let valA: number | null = null;
      let valB: number | null = null;

      if (orderBy === "collateralValue") {
        valA = priceA ? Number(dn.format(dn.mul(a.deposit, priceA))) : null;
        valB = priceB ? Number(dn.format(dn.mul(b.deposit, priceB))) : null;
      } else if (orderBy === "liqPrice") {
        const liqA = getLiquidationPrice(a.deposit, a.borrowed, Number(a.minCollRatio) / 1e18);
        const liqB = getLiquidationPrice(b.deposit, b.borrowed, Number(b.minCollRatio) / 1e18);
        valA = liqA ? Number(dn.format(liqA)) : null;
        valB = liqB ? Number(dn.format(liqB)) : null;
      } else if (orderBy === "ltv") {
        const ltvA = priceA ? getLtv(a.deposit, a.borrowed, priceA) : null;
        const ltvB = priceB ? getLtv(b.deposit, b.borrowed, priceB) : null;
        valA = ltvA ? Number(dn.format(ltvA)) : null;
        valB = ltvB ? Number(dn.format(ltvB)) : null;
      }

      // Nulls sort to end
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;

      return orderDirection === "asc" ? valA - valB : valB - valA;
    });
  }, [troves, orderBy, orderDirection, priceMap]);

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <th
      onClick={() => onSort(field)}
      className={css({
        cursor: "pointer",
        userSelect: "none",
        _hover: {
          color: "content",
        },
      })}
    >
      {label}
      {orderBy === field && (orderDirection === "asc" ? " ↑" : " ↓")}
    </th>
  );

  if (isLoading) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          padding: 64,
          color: "contentAlt",
        })}
      >
        Loading troves...
      </div>
    );
  }

  if (sortedTroves.length === 0) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          padding: 64,
          color: "contentAlt",
        })}
      >
        No troves found
      </div>
    );
  }

  return (
    <table
      className={css({
        width: "100%",
        fontSize: 14,
        "& th, & td": {
          fontWeight: "inherit",
          whiteSpace: "nowrap",
          textAlign: "right",
          padding: "12px 8px",
        },
        "& th": {
          color: "contentAlt2",
          borderBottom: "1px solid token(colors.tableBorder)",
          position: "sticky",
          top: 0,
          background: "surface",
          zIndex: 1,
        },
        "& td": {
          borderBottom: "1px solid token(colors.tableBorder)",
        },
        "& th:first-of-type, & td:first-of-type": {
          textAlign: "left",
          paddingLeft: 0,
        },
        "& th:last-of-type, & td:last-of-type": {
          paddingRight: 0,
        },
        "& tbody tr": {
          _hover: {
            background: "surfaceAlt",
          },
        },
      })}
    >
      <thead>
        <tr>
          <SortableHeader field="status" label="Status" />
          <SortableHeader field="deposit" label="Collateral" />
          <SortableHeader field="debt" label="USND Borrowed" />
          <SortableHeader field="collateralValue" label="Collateral Value" />
          <SortableHeader field="liqPrice" label="Liq. Price" />
          <SortableHeader field="ltv" label="LTV" />
          <SortableHeader field="interestRate" label="Interest" />
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        {sortedTroves.map((trove) => (
          <TroveRow key={trove.id} trove={trove} />
        ))}
      </tbody>
    </table>
  );
}
