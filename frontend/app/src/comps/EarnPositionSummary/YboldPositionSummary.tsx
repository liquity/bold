import { Amount } from "@/src/comps/Amount/Amount";
import { getTokenDisplayName, useLiquityStats } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { InfoTooltip, TokenIcon } from "@liquity2/uikit";
import { EarnPositionSummaryBase } from "./EarnPositionSummaryBase";

export function YboldPositionSummary() {
  const { data: rawStats } = useLiquityStats();

  const stats = rawStats?.yBOLD;

  return (
    <EarnPositionSummaryBase
      action={stats && {
        label: `Deposit to the yBOLD pool`,
        path: stats.link,
        external: true,
      }}
      active={false}
      poolToken="YBOLD"
      title={getTokenDisplayName("YBOLD")}
      poolInfo={
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
              7d APR
            </div>
            <Amount
              fallback="-%"
              format="1z"
              percentage
              value={stats?.weeklyApr ?? null}
            />
            <InfoTooltip
              content={{
                heading: "APR (last 7 days)",
                body: <>The annualized rate yBOLD deposits earned over the last 7 days.</>,
                footerLink: {
                  label: "Check Yearn for more details",
                  href: "https://yearn.fi/v3/1/0x9F4330700a36B29952869fac9b33f45EEdd8A3d8",
                },
              }}
            />
          </div>
        </>
      }
      subtitle={
        <>
          <div>TVL</div>
          <div>
            <Amount
              fallback="-"
              format="compact"
              prefix="$"
              value={stats?.tvl ?? null}
            />
          </div>
          <InfoTooltip heading="Total Value Locked (TVL)">
            Total amount of BOLD deposited in the yBOLD pool.
          </InfoTooltip>
        </>
      }
      infoItems={[{
        label: "BOLD deposit",
        content: (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              height: 24,
            })}
          >
            <TokenIcon symbol="BOLD" size="mini" title={null} />
          </div>
        ),
      }]}
    />
  );
}
