import type { RiskLevel } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { Value } from "@/src/comps/Value/Value";
import { LEVERAGE_PRICE_IMPACT_HIGH } from "@/src/constants";
import content from "@/src/content";
import { DNUM_0, jsonStringifyWithDnum } from "@/src/dnum-utils";
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
  id,
  label,
}: {
  field: ReactNode;
  footer?: FooterRow | FooterRow[];
  id?: string;
  label?: ReactNode;
}) {
  if (footer && !Array.isArray(footer)) {
    footer = [footer];
  }
  return (
    <div
      id={id}
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
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "minmax(0, auto) minmax(0, auto)",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                width: "100%",
              })}
            >
              <div
                className={css({
                  overflow: "hidden",
                  display: "flex",
                  gap: 16,
                  minWidth: 0,
                  maxWidth: "100%",
                  textOverflow: "ellipsis",
                })}
              >
                {start}
              </div>
              <div
                className={css({
                  minWidth: 0,
                  overflow: "hidden",
                  display: "flex",
                  gap: 16,
                  justifyContent: "flex-end",
                  maxWidth: "100%",
                  textOverflow: "ellipsis",
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
        maxWidth: "100%",
        whiteSpace: "nowrap",
        fontSize: 14,
      }}
    >
      {label && (
        <div
          className={css({
            flexShrink: 1,
            minWidth: 0,
            color: "contentAlt",
          })}
        >
          {label}
        </div>
      )}
      {value && (
        <div
          className={css({
            flexShrink: 1,
            minWidth: 0,
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
  level?: RiskLevel | null;
  help?: ReactNode;
  title?: string;
}) {
  return (
    <FooterInfo
      value={
        <div
          title={title}
          className={css({
            overflow: "hidden",
            display: "flex",
            gap: 8,
            alignItems: "center",
            whiteSpace: "nowrap",
          })}
        >
          <div
            className={css({
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            })}
          >
            <StatusDot
              mode={riskLevelToStatusMode(level)}
            />
          </div>
          <div
            className={css({
              overflow: "hidden",
              flexShrink: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
            })}
          >
            <span
              className={css({
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              })}
            >
              {label}
            </span>
            {help}
          </div>
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
                    color: higherThanMax ? "negativeStrong" : undefined,
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

export const FooterInfoPriceImpact = memo(
  function FooterInfoPriceImpact(props: {
    inputTokenName: string;
    outputTokenName: string;
    priceImpact?: Dnum | null;
  }) {
    return (
      <Field.FooterInfo
        label="Price impact"
        value={
          <Value negative={dn.gte(props.priceImpact ?? DNUM_0, LEVERAGE_PRICE_IMPACT_HIGH)}>
            <HFlex gap={4}>
              <Amount value={props.priceImpact} percentage fallback="−" />
              <InfoTooltip heading="Price impact">
                The difference between the current spot price and the price at which your {props.inputTokenName}{" "}
                gets converted to{" "}
                {props.outputTokenName}. Depends on the size of your position and the available liquidity.
              </InfoTooltip>
            </HFlex>
          </Value>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

export function FooterInfoPriceImpactNone() {
  return (
    <Field.FooterInfo
      label="Price impact"
      value="N/A"
    />
  );
}

export const FooterInfoSlippageRefundClose = memo(
  function FooterInfoSlippageRefundClose(props: {
    collateralName: string;
    slippageProtection: Dnum;
  }) {
    return (
      <Field.FooterInfo
        label="Slippage refund"
        value={
          <HFlex gap={4}>
            <Amount prefix="~" value={props.slippageProtection} suffix=" BOLD" />
            <InfoTooltip heading="Slippage refund">
              To allow for slippage, slightly more of your {props.collateralName}{" "}
              will be converted to BOLD than needed for the repayment. The remaining BOLD will be refunded to your
              wallet. The actual amount may be higher or lower than indicated here, according to the execution price of
              your trade.
            </InfoTooltip>
          </HFlex>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

export const FooterInfoSlippageRefundLeverUp = memo(
  function FooterInfoSlippageRefundLeverUp(props: {
    collateralName: string;
    slippageProtection: Dnum | null;
  }) {
    // When leveraging on the ETH branch, the wallet receives WETH instead of raw ETH
    const collateralName = props.collateralName === "ETH" ? "WETH" : props.collateralName;

    return (
      <Field.FooterInfo
        label="Slippage refund"
        value={
          <HFlex gap={4}>
            <Amount prefix="~" value={props.slippageProtection} format="4z" suffix={` ${collateralName}`} />
            <InfoTooltip heading="Slippage refund">
              To allow for slippage, slightly more BOLD will be converted to {collateralName}{" "}
              than needed to reach your chosen exposure. The remaining {collateralName}{" "}
              will be refunded to your wallet. The actual amount may be higher or lower than indicated here, according
              to the execution price of your trade.
            </InfoTooltip>
          </HFlex>
        }
      />
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next),
);

export function FooterInfoSlippageRefundNone() {
  return (
    <Field.FooterInfo
      label="Slippage refund"
      value="N/A"
    />
  );
}

Field.FooterInfo = FooterInfo;
Field.FooterInfoLiquidationPrice = FooterInfoLiquidationPrice;
Field.FooterInfoLiquidationRisk = FooterInfoLiquidationRisk;
Field.FooterInfoLoanToValue = FooterInfoLoanToValue;
Field.FooterInfoRedemptionRisk = FooterInfoRedemptionRisk;
Field.FooterInfoRiskLabel = FooterInfoRiskLabel;
Field.FooterInfoWarnLevel = FooterInfoWarnLevel;
Field.FooterInfoCollPrice = FooterInfoCollPrice;
Field.FooterInfoMaxLtv = FooterInfoMaxLtv;
Field.FooterInfoPriceImpact = FooterInfoPriceImpact;
Field.FooterInfoPriceImpactNone = FooterInfoPriceImpactNone;
Field.FooterInfoSlippageRefundClose = FooterInfoSlippageRefundClose;
Field.FooterInfoSlippageRefundLeverUp = FooterInfoSlippageRefundLeverUp;
Field.FooterInfoSlippageRefundNone = FooterInfoSlippageRefundNone;
