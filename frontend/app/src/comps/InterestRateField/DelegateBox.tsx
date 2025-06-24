import type { BranchId, Delegate } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum, formatDuration, formatRedemptionRisk } from "@/src/formatting";
import { getRedemptionRisk } from "@/src/liquity-math";
import { useDebtPositioning } from "@/src/liquity-utils";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, IconCopy, StatusDot, TextButton } from "@liquity2/uikit";
import { MiniChart } from "./MiniChart";
import { ShadowBox } from "./ShadowBox";

export function DelegateBox({
  branchId,
  delegate,
  onSelect,
  selectLabel = "Select",
}: {
  branchId: BranchId;
  delegate: Delegate;
  onSelect: (delegate: Delegate) => void;
  selectLabel: string;
}) {
  const debtPositioning = useDebtPositioning(branchId, delegate.interestRate);
  const delegationRisk = getRedemptionRisk(debtPositioning.debtInFront, debtPositioning.totalDebt);
  return (
    <ShadowBox key={delegate.id}>
      <section
        key={delegate.name}
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 16px",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.borderSoft)",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              fontSize: 20,
              fontWeight: 500,
              userSelect: "none",
            })}
          >
            <h1 title={`${delegate.name} (${delegate.address})`}>
              {delegate.name}
            </h1>
            <div
              className={css({
                display: "flex",
                gap: 6,
                alignItems: "center",
              })}
            >
              <MiniChart />
              {fmtnum(delegate.interestRate, "pct1z")}%
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "center",
              })}
            >
              <Amount
                value={delegate.boldAmount}
                format="compact"
                suffix=" BOLD"
              />
            </div>
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "center",
              })}
            >
              <StatusDot mode={riskLevelToStatusMode(delegationRisk)} />
              {formatRedemptionRisk(delegationRisk)}
            </div>
          </div>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            paddingTop: 12,
            fontSize: 14,
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.borderSoft)",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div>Interest rate range</div>
            <div>
              {fmtnum(delegate.interestRateChange.min, "pct2")}
              <span>-</span>
              {fmtnum(delegate.interestRateChange.max, "pct2")}%
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div>Max. update frequency</div>
            <div>
              {formatDuration(delegate.interestRateChange.period)}
            </div>
          </div>
          {delegate.fee && (
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                fontSize: 14,
                color: "content",
              })}
            >
              <div>
                Fees <abbr title="per annum">p.a.</abbr>
              </div>
              <div title={`${fmtnum(delegate.fee, "pctfull")}%`}>
                {fmtnum(delegate.fee, { digits: 4, scale: 100 })}%
              </div>
            </div>
          )}
        </div>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 16,
            paddingBottom: 8,
            fontSize: 14,
          })}
        >
          <div
            className={css({
              display: "flex",
              gap: 8,
            })}
          >
            <TextButton
              label={
                <>
                  Copy address
                  <IconCopy size={16} />
                </>
              }
              className={css({
                fontSize: 14,
              })}
            />
          </div>
          <div>
            <Button
              label={selectLabel}
              mode="primary"
              size="small"
              onClick={() => {
                onSelect(delegate);
              }}
            />
          </div>
        </div>
      </section>
    </ShadowBox>
  );
}
