import type { CollateralToken } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import { LEVERAGE_FACTOR_MIN, LEVERAGE_FACTOR_SUGGESTIONS, LTV_RISK, MAX_LTV_ALLOWED } from "@/src/constants";
import content from "@/src/content";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import {
  getLeverageFactorFromLiquidationPrice,
  getLeverageFactorFromLtv,
  getLiquidationPriceFromLeverage,
  getLiquidationRisk,
  getLtvFromLeverageFactor,
} from "@/src/liquity-math";
import { infoTooltipProps } from "@/src/uikit-utils";
import { roundToDecimal } from "@/src/utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, InputField, lerp, norm, Slider } from "@liquity2/uikit";
import * as dn from "dnum";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function LeverageField({
  collPrice,
  collToken,
  debt,
  deposit,
  highRiskLeverageFactor,
  leverageFactor,
  liquidationPriceField,
  liquidationRisk,
  maxLeverageFactorAllowed,
  mediumRiskLeverageFactor,
  sliderProps,
}: ReturnType<typeof useLeverageField> & {
  disabled?: boolean;
}) {
  const isDepositNegative = !deposit || dn.lt(deposit, 0);
  return (
    <InputField
      secondarySpacing={16}
      disabled={isDepositNegative}
      contextual={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 300,
            marginRight: -20,
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
          <div>
            Total debt {!debt || isDepositNegative ? "−" : (
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
            )}
          </div>
        ),
        start: content.leverageScreen.liquidationPriceField.label,
      }}
      placeholder="0.00"
      secondary={{
        start: (
          <span>
            {collToken.name} price{" "}
            <span
              className={css({
                color: "content",
              })}
            >
              ${fmtnum(collPrice, "2z")}
            </span>
          </span>
        ),
        end: (
          <HFlex gap={8}>
            Leverage {
              <span
                style={{
                  color: liquidationRisk === "high"
                    ? "#F36740"
                    : "#2F3037",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtnum(leverageFactor, "1z")}x
              </span>
            }
            <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.leverageLevel)} />
          </HFlex>
        ),
      }}
      {...liquidationPriceField.inputFieldProps}
      valueUnfocused={isDepositNegative
        ? (
          <span
            className={css({
              color: "contentAlt",
            })}
          >
            N/A
          </span>
        )
        : liquidationPriceField.inputFieldProps.value}
    />
  );
}

export function useLeverageField({
  collPrice,
  collToken,
  depositPreLeverage,
  maxLtvAllowedRatio = MAX_LTV_ALLOWED,
  onFocusChange,
}: {
  collPrice: Dnum;
  collToken: CollateralToken;
  depositPreLeverage: Dnum | null;
  maxLtvAllowedRatio?: number;
  onFocusChange?: (focused: boolean) => void;
}) {
  const isFocused = useRef(false);

  const { collateralRatio } = collToken;

  const maxLtv = dn.from(1 / collateralRatio, 18);
  const maxLeverageFactor = getLeverageFactorFromLtv(maxLtv);

  const maxLtvAllowed = dn.mul(maxLtv, maxLtvAllowedRatio);
  const maxLeverageFactorAllowed = getLeverageFactorFromLtv(maxLtvAllowed);

  const [leverageFactor, setLeverageFactor] = useState(
    getLeverageFactorFromRatio(
      LEVERAGE_FACTOR_MIN,
      maxLeverageFactor,
      LEVERAGE_FACTOR_SUGGESTIONS[0],
    ),
  );

  const ltv = getLtvFromLeverageFactor(leverageFactor);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);

  const mediumRiskLeverageFactor = getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.medium));
  const highRiskLeverageFactor = getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.high));

  // liquidation prices based on the min and max leverage factors
  const liquidationPriceBoundaries = [
    getLiquidationPriceFromLeverage(LEVERAGE_FACTOR_MIN, collPrice, collateralRatio),
    getLiquidationPriceFromLeverage(maxLeverageFactor, collPrice, collateralRatio),
  ];

  const deposit = depositPreLeverage && leverageFactor > 1
    ? dn.mul(depositPreLeverage, leverageFactor)
    : null;

  const debt = depositPreLeverage && calculateDebt(
    depositPreLeverage,
    leverageFactor,
    collPrice,
  );

  const getLeverageFactorFromLiquidationPriceClamped = (liquidationPrice: Dnum) => {
    const leverageFactor = getLeverageFactorFromLiquidationPrice(
      liquidationPrice,
      collPrice,
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
          const lf = getLeverageFactorFromLiquidationPriceClamped(liquidationPrice);
          if (lf !== null) {
            setLeverageFactor(lf);
          }
        }
      },
      onFocusChange: ({ focused, parsed: price }) => {
        isFocused.current = focused;
        onFocusChange?.(focused);

        // Make sure the the input value corresponds to the leverage
        // factor matching to the desired liquidation price.
        if (!focused && price) {
          const lf = getLeverageFactorFromLiquidationPriceClamped(price);
          if (lf !== null) {
            setLeverageFactor(lf);
          }
        }
      },
    },
  );

  const updateLeverageFactor = useCallback((leverageFactor: number) => {
    setLeverageFactor(leverageFactor);
    if (deposit && debt) {
      liquidationPriceField.setValue(dn.toString(
        getLiquidationPriceFromLeverage(leverageFactor, collPrice, collateralRatio),
        2,
      ));
    }
  }, [
    collPrice,
    collateralRatio,
    liquidationPriceField,
  ]);

  // update the leverage factor when the collateral price changes
  const previousCollPrice = useRef(collPrice);
  useEffect(() => {
    if (!dn.eq(previousCollPrice.current, collPrice) && deposit && debt) {
      liquidationPriceField.setValue(dn.toString(
        getLiquidationPriceFromLeverage(leverageFactor, collPrice, collateralRatio),
        2,
      ));
      previousCollPrice.current = collPrice;
    }
  }, [
    collPrice,
    collateralRatio,
    getLeverageFactorFromLiquidationPriceClamped,
    leverageFactor,
    liquidationPriceField,
    updateLeverageFactor,
  ]);

  const sliderProps = {
    onChange: (value: number) => {
      updateLeverageFactor(
        roundToDecimal(
          lerp(LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed, value),
          1,
        ),
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

  return {
    collPrice,
    collToken,
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
  return Math.max(
    LEVERAGE_FACTOR_MIN,
    Math.round(lerp(minLeverageFactor, maxLeverageFactor, ratio) * 10) / 10,
  );
}
