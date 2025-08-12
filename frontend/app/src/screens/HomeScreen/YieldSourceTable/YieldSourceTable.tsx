"use client";

import { FC, ReactNode, useMemo } from "react";
import { css } from "@/styled-system/css";
import { HomeTable } from "@/src/screens/HomeScreen/HomeTable.tsx";
import content from "@/src/content";
import { useBoldYieldSources } from "@/src/liquity-utils.ts";
import { YieldSourceRow } from "./components/YieldSourceRow";
import { Hint } from "@/src/screens/HomeScreen/YieldSourceTable/components/Hint";
import { Spinner } from "@/src/comps/Spinner/Spinner";

interface YieldSourceTableProps {
  compact: boolean;
}

export const YieldSourceTable: FC<YieldSourceTableProps> = ({ compact }) => {
  const { data, isLoading } = useBoldYieldSources();

  const columns: ReactNode[] = [
    "Source",
    <abbr key="apr1d" title="Annual Percentage Rate over the last 7 days">
      APR
    </abbr>,
    "TVL",
  ];

  const rows = useMemo(() => {
    return (data || []).map((row) => {
      return (
        <YieldSourceRow
          key={`${row.asset}-${row.tvl}`}
          compact={compact}
          {...row}
        />
      );
    });
  }, [data]);

  if (!compact) {
    columns.push(null);
  }

  return (
    <div
      className={css({
        gridArea: "yield",
      })}
    >
      <div
        className={css({
          position: "relative",
          zIndex: 2,
        })}
      >
        <HomeTable
          loading={isLoading && <Spinner />}
          title={content.home.yieldTable.title}
          columns={columns}
          rows={rows}
        />
      </div>
      <Hint />
    </div>
  );
};
