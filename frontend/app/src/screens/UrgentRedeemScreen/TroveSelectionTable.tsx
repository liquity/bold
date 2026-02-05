import type { TroveWithICR } from "@/src/urgent-redemption-utils";

import { Amount } from "@/src/comps/Amount/Amount";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { shortenTroveId } from "@/src/liquity-utils";
import { MIN_GUARANTEED_ICR, TROVES_PER_PAGE } from "@/src/urgent-redemption-utils";
import { css } from "@/styled-system/css";
import { Button, Checkbox, HFlex, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useMemo, useState } from "react";

type TroveSelectionTableProps = {
  troves: TroveWithICR[];
  selectedTroveIds: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
};

export function TroveSelectionTable({
  troves,
  selectedTroveIds,
  onSelectionChange,
}: TroveSelectionTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const sortedTroves = useMemo(() => {
    return [...troves].sort((a, b) => dn.cmp(b.icr, a.icr));
  }, [troves]);
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

  const toggleTrove = (troveId: string) => {
    const newSelected = new Set(selectedTroveIds);
    if (newSelected.has(troveId)) {
      newSelected.delete(troveId);
    } else {
      newSelected.add(troveId);
    }
    onSelectionChange(newSelected);
  };

  const selectAllOnPage = () => {
    const newSelected = new Set(selectedTroveIds);
    for (const trove of paginatedTroves) {
      newSelected.add(trove.troveId);
    }
    onSelectionChange(newSelected);
  };

  const clearSelection = () => {
    onSelectionChange(new Set());
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
          label={allOnPageSelected
            ? content.urgentRedeemScreen.troveTable.deselectPage
            : content.urgentRedeemScreen.troveTable.selectAllOnPage}
          mode="secondary"
          size="small"
          onClick={allOnPageSelected ? clearSelection : selectAllOnPage}
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
          border: "1px solid token(colors.border)",
          borderRadius: 8,
          overflow: "hidden",
        })}
      >
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "40px 1fr 1fr 1fr 1fr",
            gap: 8,
            padding: "12px 16px",
            background: "fieldSurface",
            fontWeight: 600,
            fontSize: 14,
            borderBottom: "1px solid token(colors.border)",
          })}
        >
          <div />
          <div>{content.urgentRedeemScreen.troveTable.columnTroveId}</div>
          <div className={css({ textAlign: "right" })}>{content.urgentRedeemScreen.troveTable.columnCollateral}</div>
          <div className={css({ textAlign: "right" })}>{content.urgentRedeemScreen.troveTable.columnDebt}</div>
          <div className={css({ textAlign: "right" })}>{content.urgentRedeemScreen.troveTable.columnIcr}</div>
        </div>

        {paginatedTroves.map((trove) => {
          const isSelected = selectedTroveIds.has(trove.troveId);
          const hasFullBonus = dn.gte(trove.icr, MIN_GUARANTEED_ICR);

          return (
            <div
              key={trove.troveId}
              className={css({
                display: "grid",
                gridTemplateColumns: "40px 1fr 1fr 1fr 1fr",
                gap: 8,
                padding: "12px 16px",
                fontSize: 14,
                borderBottom: "1px solid token(colors.border)",
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
              <div className={css({ display: "flex", alignItems: "center" })}>
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleTrove(trove.troveId)}
                />
              </div>
              <div
                className={css({
                  fontFamily: "monospace",
                  color: "contentAlt",
                })}
                title={trove.troveId}
              >
                {shortenTroveId(trove.troveId)}
              </div>
              <div className={css({ textAlign: "right" })}>
                <Amount format="4z" value={trove.coll} />
              </div>
              <div className={css({ textAlign: "right" })}>
                <Amount format="2z" value={trove.debt} />
              </div>
              <div
                className={css({
                  textAlign: "right",
                  color: hasFullBonus ? "positive" : "contentAlt",
                })}
                title={hasFullBonus
                  ? content.urgentRedeemScreen.troveTable.icrFullBonus
                  : content.urgentRedeemScreen.troveTable.icrPartialBonus}
              >
                <Amount value={trove.icr} percentage />
              </div>
            </div>
          );
        })}

        {paginatedTroves.length === 0 && (
          <div
            className={css({
              padding: 24,
              textAlign: "center",
              color: "contentAlt",
            })}
          >
            {content.urgentRedeemScreen.troveTable.noTrovesAvailable}
          </div>
        )}
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
