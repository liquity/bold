import type { RiskLevel } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import content from "@/src/content";
import { jsonStringifyWithDnum } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { formatLiquidationRisk, formatRedemptionRisk } from "@/src/formatting";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, StatusDot } from "@liquity2/uikit";
import * as dn from "dnum";
import { memo } from "react";

type FooterRow = {
  start?: ReactNode;
  end?: ReactNode;
};

export function Field({
  field,
  footer,
  label,
}: {
  field: ReactNode;
  footer?: FooterRow | FooterRow[];
  label?: ReactNode;
}) {
  if (footer && !Array.isArray(footer)) {
    footer = [footer];
  }
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 8,
      })}
    >
      {label
        ? (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 8,
            })}
          >
            <div
              className={css({
                color: "contentAlt",
              })}
            >
              {label}
            </div>
            {field}
          </div>
        )
        : field}
      {footer && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
          })}
        >
          {footer.map(({ start, end }, index) => (
            <div
              key={index}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                })}
              >
                {start}
              </div>
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                })}
              >
                {end}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FooterInfo({
  label,
  value,
  title,
}: {
  label?: ReactNode;
  value?: ReactNode;
  title?: string;
}) {
  return (
    <div
      title={title}
      style={{
        display: "flex",
        gap: 8,
        whiteSpace: "nowrap",
        fontSize: 14,
      }}
    >
      {label && (
        <div
          className={css({
            color: "contentAlt",
          })}
        >
          {label}
        </div>
      )}
      {value && (
        <div
          className={css({
            display: "flex",
            alignItems: "center",
          })}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function FooterInfoWarnLevel({
  label,
  level,
  help,
  title,
}: {
  label: ReactNode;
  level?: "low" | "medium" | "high" | null;
  help?: ReactNode;
  title?: string;
}) {
  return (
    <FooterInfo
      value={
        <div
          title={title}
          className={css({
            display: "flex",
            gap: 8,
            alignItems: "center",
            whiteSpace: "nowrap",
          })}
        >
          <StatusDot
            mode={riskLevelToStatusMode(level)}
          />
          <HFlex gap={4} alignItems="center">
            {label}
            {help}
          </HFlex>
        </div>
      }
    />
  );
}

export const FooterInfoLiquidationRisk = memo(function FooterInfoLiquidationRisk({
  riskLevel,
}: {
  riskLevel: RiskLevel | null;
}) {
  const label = formatLiquidationRisk(riskLevel);
  return (
    <Field.FooterInfoWarnLevel
      help={
        <InfoTooltip
          {...infoTooltipProps(content.generalInfotooltips.loanLiquidationRisk)}
        />
      }
      label={label}
      level={riskLevel}
    />
  );
});

export const FooterInfoRedemptionRisk = memo(function FooterInfoRedemptionRisk({
  riskLevel,
}: {
  riskLevel: RiskLevel | null;
}) {
  const label = formatRedemptionRisk(riskLevel);
  return (
    <Field.FooterInfoWarnLevel
      help={
        <InfoTooltip
          {...infoTooltipProps(content.generalInfotooltips.loanRedemptionRisk)}
          heading={
            <FooterInfoRiskLabel
              label={label}
              riskLevel={riskLevel}
            />
          }
        />
      }
      label={label}
      level={riskLevel}
    />
  );
});

export const FooterInfoLoanToValue = memo(
  function FooterInfoLoanToValue({
    ltvRatio,
    maxLtvRatio,
  }: {
    ltvRatio: Dnum | null;
    maxLtvRatio: Dnum;
  }) {
    const higherThanMax = ltvRatio && dn.gt(ltvRatio, maxLtvRatio);
    return (
      <Field.FooterInfo
        label="LTV"
        value={
          <HFlex gap={4}>
            {ltvRatio
              ? (
                <span
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {fmtnum(higherThanMax ? maxLtvRatio : ltvRatio, {
                    dust: false,
                    prefix: higherThanMax ? ">" : "",
                    preset: "pct2z",
                    suffix: "%",
                  })}
                </span>
              )
              : "−"}
            <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.loanLtv)} />
          </HFlex>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

export const FooterInfoLiquidationPrice = memo(
  function FooterInfoLiquidationPrice({
    liquidationPrice,
  }: {
    liquidationPrice: Dnum | null;
  }) {
    return (
      <Field.FooterInfo
        label="Liquidation price"
        value={
          <HFlex gap={4}>
            {liquidationPrice
              ? fmtnum(liquidationPrice, { prefix: "$", preset: "2z" })
              : "−"}
            <InfoTooltip
              {...infoTooltipProps(content.generalInfotooltips.loanLiquidationPrice)}
            />
          </HFlex>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

export function FooterInfoRiskLabel({
  label,
  riskLevel,
}: {
  label: ReactNode;
  riskLevel: RiskLevel | null;
}) {
  return riskLevel
    ? (
      <HFlex gap={8} justifyContent="flex-start">
        <StatusDot mode={riskLevelToStatusMode(riskLevel)} />
        {label}
      </HFlex>
    )
    : label;
}

export const FooterInfoCollPrice = memo(
  function FooterInfoCollPrice({
    collName,
    collPriceUsd,
  }: {
    collName: string;
    collPriceUsd: Dnum;
  }) {
    return (
      <Field.FooterInfo
        label={`${collName} Price`}
        value={
          <HFlex gap={4}>
            <span
              className={css({
                fontVariantNumeric: "tabular-nums",
              })}
            >
              {fmtnum(collPriceUsd, { prefix: "$", preset: "2z" })}
            </span>
            <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.ethPrice)} />
          </HFlex>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

export const FooterInfoMaxLtv = memo(
  function FooterInfoMaxLtv({
    maxLtv,
  }: {
    maxLtv: Dnum;
  }) {
    return (
      <Field.FooterInfo
        label="Max LTV"
        value={
          <HFlex gap={4}>
            <div>
              {fmtnum(maxLtv, "pct2z")}%
            </div>
            <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.loanMaxLtv)} />
          </HFlex>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

Field.FooterInfo = FooterInfo;
Field.FooterInfoLiquidationPrice = FooterInfoLiquidationPrice;
Field.FooterInfoLiquidationRisk = FooterInfoLiquidationRisk;
Field.FooterInfoLoanToValue = FooterInfoLoanToValue;
Field.FooterInfoRedemptionRisk = FooterInfoRedemptionRisk;
Field.FooterInfoRiskLabel = FooterInfoRiskLabel;
Field.FooterInfoWarnLevel = FooterInfoWarnLevel;
Field.FooterInfoCollPrice = FooterInfoCollPrice;
Field.FooterInfoMaxLtv = FooterInfoMaxLtv;
