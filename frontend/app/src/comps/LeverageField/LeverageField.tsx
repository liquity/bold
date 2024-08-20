import type { CollateralToken } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import { Field } from "@/src/comps/Field/Field";
import { LEVERAGE_FACTOR_MIN, LEVERAGE_FACTOR_SUGGESTIONS, LTV_RISK, MAX_LTV_ALLOWED } from "@/src/constants";
import content from "@/src/content";
import { useInputFieldValue } from "@/src/form-utils";
import {
  getLeveragedLiquidationPrice,
  getLeverageFactorFromLiquidationPrice,
  getLeverageFactorFromLtv,
  getLiquidationRiskFromLeverageFactor,
  getLtvFromLeverageFactor,
} from "@/src/liquity-math";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, InputField, lerp, norm, PillButton, Slider } from "@liquity2/uikit";
import * as dn from "dnum";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function LeverageField({
  debt,
  deposit,
  highRiskLeverageFactor,
  leverageFactor,
  leverageFactorSuggestions,
  liquidationPriceField,
  liquidationRisk,
  ltv,
  maxLeverageFactorAllowed,
  maxLtv,
  mediumRiskLeverageFactor,
  sliderProps,
  updateLeverageFactor,
}: ReturnType<typeof useLeverageField>) {
  return (
    <Field
      field={
        <InputField
          contextual={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 300,
              }}
            >
              <Slider
                gradient={[
                  norm(
                    mediumRiskLeverageFactor,
                    LEVERAGE_FACTOR_MIN,
                    maxLeverageFactorAllowed,
                  ),
                  norm(
                    highRiskLeverageFactor,
                    LEVERAGE_FACTOR_MIN,
                    maxLeverageFactorAllowed,
                  ),
                ]}
                {...sliderProps}
              />
            </div>
          }
          label={{
            end: (
              <span>
                Leverage{" "}
                <span
                  title={dn.format([BigInt(Math.round(leverageFactor * 10)), 1])}
                  style={{
                    color: liquidationRisk === "high"
                      ? "#F36740"
                      : "#2F3037",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {dn.format([BigInt(Math.round(leverageFactor * 10)), 1], {
                    digits: 1,
                    trailingZeros: true,
                  })}x
                </span>
              </span>
            ),
            start: content.leverageScreen.liquidationPriceField.label,
          }}
          placeholder="0.00"
          secondary={{
            start: (
              <div>
                Total debt {debt
                  ? (
                    <>
                      <span
                        className={css({
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        {dn.format(debt, { digits: 2, trailingZeros: true })}
                      </span>
                      {" BOLD"}
                    </>
                  )
                  : "−"}
              </div>
            ),
            end: (
              <HFlex gap={6}>
                {leverageFactorSuggestions.map((factor) => (
                  <PillButton
                    key={factor}
                    label={`${factor.toFixed(1)}x`}
                    onClick={() => updateLeverageFactor(factor)}
                    warnLevel={getLiquidationRiskFromLeverageFactor(
                      factor,
                      mediumRiskLeverageFactor,
                      highRiskLeverageFactor,
                    )}
                  />
                ))}
                <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.leverageLevel)} />
              </HFlex>
            ),
          }}
          {...liquidationPriceField.inputFieldProps}
        />
      }
      footer={[[
        // eslint-disable-next-line react/jsx-key
        <>
          <Field.FooterInfoLiquidationRisk
            riskLevel={liquidationRisk}
          />
          <Field.FooterInfoLoanToValue
            ltvRatio={ltv}
            maxLtvRatio={maxLtv}
          />
        </>,
        // eslint-disable-next-line react/jsx-key
        <HFlex>
          <span
            className={css({
              color: "contentAlt",
            })}
          >
            Exposure
          </span>
          <span
            className={css({
              fontVariantNumeric: "tabular-nums",
            })}
          >
            {(deposit && dn.gt(deposit, 0))
              ? `${dn.format(deposit, { digits: 2, trailingZeros: true })} ETH`
              : "−"}
          </span>
          <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.exposure)} />
        </HFlex>,
      ]]}
    />
  );
}

export function useLeverageField({
  collPrice,
  collToken,
  depositPreLeverage,
  onFocusChange,
  updatePriority,
}: {
  collPrice: Dnum;
  collToken: CollateralToken;
  depositPreLeverage: Dnum | null;
  onFocusChange?: (focused: boolean) => void;
  updatePriority: "liquidationPrice" | "leverageFactor";
}) {
  const { collateralRatio } = collToken;

  const maxLtv = dn.from(1 / collateralRatio, 18);
  const maxLeverageFactor = getLeverageFactorFromLtv(maxLtv);

  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED);
  const maxLeverageFactorAllowed = getLeverageFactorFromLtv(maxLtvAllowed);

  const [leverageFactor, setLeverageFactor] = useState(
    getLeverageFactorFromRatio(
      LEVERAGE_FACTOR_MIN,
      maxLeverageFactor,
      LEVERAGE_FACTOR_SUGGESTIONS[0],
    ),
  );

  const ltv = getLtvFromLeverageFactor(leverageFactor);

  const mediumRiskLeverageFactor = getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.medium));
  const highRiskLeverageFactor = getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.high));

  const liquidationRisk = getLiquidationRiskFromLeverageFactor(
    leverageFactor,
    mediumRiskLeverageFactor,
    highRiskLeverageFactor,
  );

  // liquidation prices based on the min and max leverage factors
  const liquidationPriceBoundaries = [
    getLeveragedLiquidationPrice(collPrice, LEVERAGE_FACTOR_MIN, collateralRatio),
    getLeveragedLiquidationPrice(collPrice, maxLeverageFactor, collateralRatio),
  ];

  const getLeverageFactorFromLiquidationPriceClamped = (liquidationPrice: Dnum) => {
    const leverageFactor = getLeverageFactorFromLiquidationPrice(
      collPrice,
      liquidationPrice,
      collateralRatio,
    );

    if (dn.lt(liquidationPrice, liquidationPriceBoundaries[0])) {
      return LEVERAGE_FACTOR_MIN;
    }

    if (dn.gt(liquidationPrice, liquidationPriceBoundaries[1])) {
      return maxLeverageFactorAllowed;
    }

    return leverageFactor;
  };

  const leverageFactorSuggestions = useMemo(() => {
    return LEVERAGE_FACTOR_SUGGESTIONS.map((factor) => (
      getLeverageFactorFromRatio(LEVERAGE_FACTOR_MIN, maxLeverageFactor, factor)
    ));
  }, [maxLeverageFactor]);

  const liquidationPriceField = useInputFieldValue(
    (value) => `$ ${dn.format(value, { digits: 2, trailingZeros: true })}`,
    {
      onChange: ({ parsed: liquidationPrice, focused }) => {
        if (liquidationPrice && dn.gt(liquidationPrice, 0) && liquidationPriceField.isFocused && focused) {
          setLeverageFactor(getLeverageFactorFromLiquidationPriceClamped(liquidationPrice));
        }
      },
      onFocusChange: ({ focused, parsed: price }) => {
        onFocusChange?.(focused);

        // Make sure the the input value corresponds to the leverage
        // factor matching to the desired liquidation price.
        if (!focused && price) {
          updateLeverageFactor(getLeverageFactorFromLiquidationPriceClamped(price));
        }
      },
    },
  );

  const updateLeverageFactor = useCallback((leverageFactor: number) => {
    setLeverageFactor(leverageFactor);
    liquidationPriceField.setValue(dn.toString(
      getLeveragedLiquidationPrice(collPrice, leverageFactor, collateralRatio),
      2,
    ));
  }, [
    collPrice,
    collateralRatio,
    liquidationPriceField,
  ]);

  // update the leverage factor when the collateral price changes
  const previousCollPrice = useRef(collPrice);
  useEffect(() => {
    if (updatePriority === "liquidationPrice" && !dn.eq(previousCollPrice.current, collPrice)) {
      liquidationPriceField.setValue(dn.toString(
        getLeveragedLiquidationPrice(collPrice, leverageFactor, collateralRatio),
        2,
      ));
      previousCollPrice.current = collPrice;
    }

    // if (updatePriority === "leverageFactor" && liquidationPriceField.parsed) {
    //   updateLeverageFactor(getLeverageFactorFromLiquidationPriceClamped(liquidationPriceField.parsed));
    // }
  }, [
    collPrice,
    updatePriority,
    collateralRatio,
    getLeverageFactorFromLiquidationPriceClamped,
    leverageFactor,
    liquidationPriceField,
    updateLeverageFactor,
  ]);

  const sliderProps = {
    onChange: (value: number) => {
      updateLeverageFactor(
        Math.round(
          lerp(LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed, value) * 10,
        ) / 10,
      );
    },
    value: norm(
      leverageFactor,
      LEVERAGE_FACTOR_MIN,
      maxLeverageFactorAllowed,
    ),
  };

  function calculateTotalPositionValue(deposit: Dnum, leverageFactor: number, collateralPrice: Dnum): Dnum {
    return dn.mul(dn.mul(deposit, dn.from(leverageFactor, 18)), collateralPrice);
  }

  function calculateDebt(deposit: Dnum, leverageFactor: number, collateralPrice: Dnum): Dnum {
    const totalPositionValue = calculateTotalPositionValue(deposit, leverageFactor, collateralPrice);
    const initialDepositValue = dn.mul(deposit, collateralPrice);
    return dn.sub(totalPositionValue, initialDepositValue);
  }

  const deposit = depositPreLeverage && leverageFactor > 1
    ? dn.mul(depositPreLeverage, leverageFactor)
    : null;

  const debt = depositPreLeverage && calculateDebt(depositPreLeverage, leverageFactor, collPrice);

  return {
    debt,
    deposit,
    highRiskLeverageFactor,
    leverageFactor,
    leverageFactorSuggestions,
    liquidationPriceField,
    liquidationRisk,
    ltv,
    maxLeverageFactor,
    maxLeverageFactorAllowed,
    maxLtv,
    maxLtvAllowed,
    mediumRiskLeverageFactor,
    sliderProps,
    updateLeverageFactor,
  };
}

function getLeverageFactorFromRatio(minLeverageFactor: number, maxLeverageFactor: number, ratio: number) {
  return Math.round(lerp(minLeverageFactor, maxLeverageFactor, ratio) * 10) / 10;
}