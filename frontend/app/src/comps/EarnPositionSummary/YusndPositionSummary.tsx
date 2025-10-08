import type { Dnum, PositionYusnd } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
// import { getBranch } from "@/src/liquity-utils";
import { useYusndStats } from "@/src/yusnd";
// import { isCollIndex } from "@/src/types";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { EarnPositionSummaryBase } from "./EarnPositionSummaryBase";

export function YusndPositionSummary({
  linkToScreen,
  prevYusndPosition,
  yusndPosition,
  tvl,
  txPreviewMode,
}: {
  linkToScreen?: boolean;
  prevYusndPosition?: PositionYusnd | null;
  yusndPosition: PositionYusnd | null;
  tvl?: Dnum | null;
  txPreviewMode?: boolean;
}) {
  const stats = useYusndStats();
  const tvl_ = tvl ?? stats.data?.totalUsnd ?? null;

  const active = Boolean(
    txPreviewMode || (yusndPosition && dn.gt(yusndPosition.yusnd, 0)),
  );

  return (
    <EarnPositionSummaryBase
      action={!linkToScreen ? null : {
        label: `${active ? "Manage" : "Deposit to"} the yUSND pool`,
        path: `/earn/yusnd`,
      }}
      active={active}
      poolToken="YUSND"
      title="yUSND by Yearn"
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
                body: <>The annualized rate yUSND deposits earned over the last 24 hours.</>,
                footerLink: {
                  label: "Check Dune for more details",
                  href: "https://dune.com/niftyteam/nerite",
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
                body: <>The annualized rate yUSND deposits earned over the last 7 days.</>,
                footerLink: {
                  label: "Check Dune for more details",
                  href: "https://dune.com/niftyteam/nerite",
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
              suffix=" USND"
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
              <div>Total amount of USND deposited in the yUSND pool.</div>
              {/* <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  whiteSpace: "nowrap",
                })}
              >
                <div>Pools weight:</div>
                <div className={css({
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                })}>
                  {stats.data?.weights.map((weight, index) => {
                    if (!isCollIndex(index)) {
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
                          format="pct2z"
                          value={weight}
                        />
                      </div>
                    );
                  })}
                </div>
              </div> */}
            </div>
          </InfoTooltip>
        </>
      }
      infoItems={[
        !active ? null : {
          label: "yUSND Balance",
          content: (
            <>
              <div
                title={active
                  ? `${fmtnum(yusndPosition?.yusnd, "full")} yUSND`
                  : undefined}
                className={css({
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                })}
              >
                {active && fmtnum(yusndPosition?.yusnd)}
                <TokenIcon symbol="YUSND" size="mini" title="Yield-bearing USND optimized by Yearn." />
              </div>
              {prevYusndPosition && (
                <div
                  title={`${fmtnum(prevYusndPosition.yusnd, "full")} yUSND`}
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
                  {fmtnum(prevYusndPosition.yusnd)}
                  <TokenIcon symbol="YUSND" size="mini" title="Yield-bearing USND optimized by Yearn." />
                </div>
              )}
            </>
          ),
        },
        {
          label: "Deposit", // prev: USND Deposit
          content: (
            <>
              <div
                title={active
                  ? `${fmtnum(yusndPosition?.yusnd, "full")} yUSND`
                  : undefined}
                className={css({
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                })}
              >
                {active && fmtnum(yusndPosition?.yusnd)}
                <TokenIcon symbol="USND" size="mini" title={null} />
              </div>
              {prevYusndPosition && (
                <div
                  title={`${fmtnum(prevYusndPosition.yusnd, "full")} yUSND`}
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
                  {fmtnum(prevYusndPosition.usnd)}
                  <TokenIcon symbol="USND" size="mini" title={null} />
                </div>
              )}
            </>
          ),
        },
        // Prev: did not exist
        txPreviewMode ? null : {
          label: "Rewards",
          content: (
            <HFlex gap={4}>
              <div>
                Earn
              </div>
              <TokenIcon.Group size="mini">
                <TokenIcon symbol="USND" />
                <TokenIcon symbol="SUP" />
              </TokenIcon.Group>
            </HFlex>
          ),
        },
      ].filter((item) => item !== null)}
    />
  );
}
