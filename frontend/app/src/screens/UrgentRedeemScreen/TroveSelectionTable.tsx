import type { Dnum, TroveId } from "@/src/types";
import type { TroveWithICR } from "@/src/urgent-redemption-utils";

import { Amount } from "@/src/comps/Amount/Amount";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { shortenTroveId } from "@/src/liquity-utils";
import { sortByRedeemableValue, TROVES_PER_PAGE } from "@/src/urgent-redemption-utils";
import { css } from "@/styled-system/css";
import { Button, Checkbox, HFlex, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useMemo, useState } from "react";

type TroveSelectionTableProps = {
  troves: TroveWithICR[];
  price: Dnum;
  selectedTroveIds: Set<TroveId>;
  onSelectionChange: (selected: Set<TroveId>) => void;
};

export function TroveSelectionTable({
  troves,
  price,
  selectedTroveIds,
  onSelectionChange,
}: TroveSelectionTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const sortedTroves = useMemo(
    () => sortByRedeemableValue(troves, price),
    [troves, price],
  );
  const totalPages = Math.ceil(sortedTroves.length / TROVES_PER_PAGE);
  const paginatedTroves = useMemo(() => {
    const start = currentPage * TROVES_PER_PAGE;
    return sortedTroves.slice(start, start + TROVES_PER_PAGE);
  }, [sortedTroves, currentPage]);

  const selectedTotals = useMemo(() => {
    const selected = troves.filter((t) => selectedTroveIds.has(t.troveId));
    return {
      count: selected.length,
      totalDebt: selected.reduce((sum, t) => dn.add(sum, t.debt), DNUM_0),
      totalColl: selected.reduce((sum, t) => dn.add(sum, t.coll), DNUM_0),
    };
  }, [troves, selectedTroveIds]);

  const toggleTrove = (troveId: TroveId) => {
    const newSelected = new Set<TroveId>(selectedTroveIds);
    if (newSelected.has(troveId)) {
      newSelected.delete(troveId);
    } else {
      newSelected.add(troveId);
    }
    onSelectionChange(newSelected);
  };

  const selectAllOnPage = () => {
    const newSelected = new Set<TroveId>(selectedTroveIds);
    for (const trove of paginatedTroves) {
      newSelected.add(trove.troveId);
    }
    onSelectionChange(newSelected);
  };

  const clearSelection = () => {
    onSelectionChange(new Set<TroveId>());
  };

  const allOnPageSelected = paginatedTroves.every((t) => selectedTroveIds.has(t.troveId));

  return (
    <VFlex gap={16}>
      <div
        className={css({
          padding: 12,
          background: "fieldSurface",
          borderRadius: 8,
          fontSize: 14,
        })}
      >
        <HFlex justifyContent="space-between">
          <span>
            {content.urgentRedeemScreen.troveTable.trovesSelected(selectedTotals.count)}
          </span>
          <HFlex gap={16}>
            <span>
              {content.urgentRedeemScreen.troveTable.totalDebt}{" "}
              <Amount format="2z" value={selectedTotals.totalDebt} />{" "}
              {content.urgentRedeemScreen.troveTable.totalDebtUnit}
            </span>
            <span>
              {content.urgentRedeemScreen.troveTable.totalColl}{" "}
              <Amount format="4z" value={selectedTotals.totalColl} />
            </span>
          </HFlex>
        </HFlex>
      </div>

      <HFlex gap={8}>
        <Button
          label={content.urgentRedeemScreen.troveTable.selectAllOnPage}
          mode="secondary"
          size="small"
          onClick={selectAllOnPage}
          disabled={allOnPageSelected}
        />
        <Button
          label={content.urgentRedeemScreen.troveTable.clearSelection}
          mode="secondary"
          size="small"
          onClick={clearSelection}
          disabled={selectedTroveIds.size === 0}
        />
      </HFlex>

      <div
        className={css({
          border: "1px solid token(colors.tableBorder)",
          borderRadius: 8,
          overflow: "hidden",
        })}
      >
        <table
          className={css({
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            "& th, & td": {
              padding: "12px 16px",
              textAlign: "right",
            },
            "& th:first-of-type, & td:first-of-type": {
              width: 40,
            },
            "& th:nth-of-type(2), & td:nth-of-type(2)": {
              textAlign: "left",
            },
          })}
        >
          <thead>
            <tr
              className={css({
                background: "fieldSurface",
                fontWeight: 600,
                borderBottom: "1px solid token(colors.tableBorder)",
              })}
            >
              <th />
              <th>{content.urgentRedeemScreen.troveTable.columnTroveId}</th>
              <th>{content.urgentRedeemScreen.troveTable.columnCollateral}</th>
              <th>{content.urgentRedeemScreen.troveTable.columnDebt}</th>
              <th>{content.urgentRedeemScreen.troveTable.columnIcr}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTroves.map((trove) => {
              const isSelected = selectedTroveIds.has(trove.troveId);
              return (
                <tr
                  key={trove.troveId}
                  className={css({
                    borderBottom: "1px solid token(colors.tableBorder)",
                    background: isSelected ? "fieldSurface" : "transparent",
                    cursor: "pointer",
                    _hover: {
                      background: "fieldSurface",
                    },
                    _last: {
                      borderBottom: "none",
                    },
                  })}
                  onClick={() => toggleTrove(trove.troveId)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleTrove(trove.troveId)}
                    />
                  </td>
                  <td
                    className={css({
                      fontFamily: "body",
                      color: "contentAlt",
                    })}
                    title={trove.troveId}
                  >
                    {shortenTroveId(trove.troveId)}
                  </td>
                  <td>
                    <Amount format="4z" value={trove.coll} />
                  </td>
                  <td>
                    <Amount format="2z" value={trove.debt} />
                  </td>
                  <td>
                    <Amount value={trove.icr} percentage format="2z" />
                  </td>
                </tr>
              );
            })}
            {paginatedTroves.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className={css({
                    padding: 24,
                    textAlign: "center",
                    color: "contentAlt",
                  })}
                >
                  {content.urgentRedeemScreen.troveTable.noTrovesAvailable}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <HFlex justifyContent="center" gap={8}>
          <Button
            label={content.urgentRedeemScreen.troveTable.previous}
            mode="secondary"
            size="small"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          />
          <span className={css({ padding: "0 16px", lineHeight: "32px" })}>
            {content.urgentRedeemScreen.troveTable.page(currentPage + 1, totalPages)}
          </span>
          <Button
            label={content.urgentRedeemScreen.troveTable.next}
            mode="secondary"
            size="small"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </HFlex>
      )}
    </VFlex>
  );
}
