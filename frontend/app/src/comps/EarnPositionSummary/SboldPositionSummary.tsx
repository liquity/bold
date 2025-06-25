import type { Dnum, PositionSbold } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
import { getBranch } from "@/src/liquity-utils";
import { useSboldStats } from "@/src/sbold";
import { isBranchId } from "@/src/types";
import { css } from "@/styled-system/css";
import { InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { EarnPositionSummaryBase } from "./EarnPositionSummaryBase";

export function SboldPositionSummary({
  linkToScreen,
  prevSboldPosition,
  sboldPosition,
  tvl,
  txPreviewMode,
}: {
  linkToScreen?: boolean;
  prevSboldPosition?: PositionSbold | null;
  sboldPosition: PositionSbold | null;
  tvl?: Dnum | null;
  txPreviewMode?: boolean;
}) {
  const stats = useSboldStats();
  const tvl_ = tvl ?? stats.data?.totalBold ?? null;

  const active = Boolean(
    txPreviewMode || (sboldPosition && dn.gt(sboldPosition.sbold, 0)),
  );

  return (
    <EarnPositionSummaryBase
      action={!linkToScreen ? null : {
        label: `${active ? "Manage" : "Deposit to"} the sBOLD pool`,
        path: `/earn/sbold`,
      }}
      active={active}
      poolToken="SBOLD"
      title="sBOLD by K3 Capital"
      poolInfo={txPreviewMode ? <TagPreview /> : (
        <>
          <div
            className={css({
              display: "flex",
              gap: 6,
            })}
          >
            <div
              className={css({
                color: "contentAlt2",
              })}
            >
              APR
            </div>
            <div>
              <Amount
                fallback="-%"
                format="1z"
                percentage
                value={stats.data?.apr ?? null}
              />
            </div>
            <InfoTooltip
              content={{
                heading: "Current APR",
                body: <>The annualized rate sBOLD deposits earned over the last 24 hours.</>,
                footerLink: {
                  label: "Check Dune for more details",
                  href: "https://dune.com/liquity/liquity-v2",
                },
              }}
            />
          </div>
          <div
            className={css({
              display: "flex",
              gap: 4,
              fontSize: 14,
            })}
          >
            <div
              className={css({
                whiteSpace: "nowrap",
                color: "contentAlt2",
              })}
            >
              7d APR
            </div>
            <Amount
              fallback="-%"
              format="1z"
              percentage
              value={stats.data?.apr7d ?? null}
            />
            <InfoTooltip
              content={{
                heading: "APR (last 7 days)",
                body: <>The annualized rate sBOLD deposits earned over the last 7 days.</>,
                footerLink: {
                  label: "Check Dune for more details",
                  href: "https://dune.com/liquity/liquity-v2",
                },
              }}
            />
          </div>
        </>
      )}
      subtitle={
        <>
          <div>TVL</div>
          <div>
            <Amount
              fallback="-"
              format="compact"
              suffix=" BOLD"
              value={tvl_}
            />
          </div>
          <InfoTooltip heading="Total Value Locked (TVL)">
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 8,
              })}
            >
              <div>Total amount of BOLD deposited in the sBOLD pool.</div>
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                  whiteSpace: "nowrap",
                })}
              >
                <div>Pools weight:</div>
                {stats.data?.weights.map((weight, index) => {
                  if (!isBranchId(index)) {
                    return null;
                  }
                  const branch = getBranch(index);
                  return (
                    <div
                      key={index}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      })}
                    >
                      <TokenIcon
                        symbol={branch.symbol}
                        size="mini"
                      />
                      <Amount
                        percentage
                        format="pctfull"
                        value={weight}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </InfoTooltip>
        </>
      }
      infoItems={[
        !active ? null : {
          label: "sBOLD Balance",
          content: (
            <>
              <div
                title={active
                  ? `${fmtnum(sboldPosition?.sbold, "full")} sBOLD`
                  : undefined}
                className={css({
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                })}
              >
                {active && fmtnum(sboldPosition?.sbold)}
                <TokenIcon symbol="SBOLD" size="mini" title={null} />
              </div>
              {prevSboldPosition && (
                <div
                  title={`${fmtnum(prevSboldPosition.sbold, "full")} sBOLD`}
                  className={css({
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 4,
                    height: 24,
                    color: "contentAlt",
                    textDecoration: "line-through",
                  })}
                >
                  {fmtnum(prevSboldPosition.sbold)}
                  <TokenIcon symbol="SBOLD" size="mini" title={null} />
                </div>
              )}
            </>
          ),
        },
        {
          label: "BOLD Deposit",
          content: (
            <>
              <div
                title={active
                  ? `${fmtnum(sboldPosition?.bold, "full")} BOLD`
                  : undefined}
                className={css({
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                })}
              >
                {active && fmtnum(sboldPosition?.bold)}
                <TokenIcon symbol="BOLD" size="mini" title={null} />
              </div>
              {prevSboldPosition && (
                <div
                  title={`${fmtnum(prevSboldPosition.bold, "full")} BOLD`}
                  className={css({
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 4,
                    height: 24,
                    color: "contentAlt",
                    textDecoration: "line-through",
                  })}
                >
                  {fmtnum(prevSboldPosition.bold)}
                  <TokenIcon symbol="BOLD" size="mini" title={null} />
                </div>
              )}
            </>
          ),
        },
      ].filter((item) => item !== null)}
    />
  );
}
