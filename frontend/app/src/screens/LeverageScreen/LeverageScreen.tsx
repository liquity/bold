"use client";

import type { Dnum } from "dnum";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import {
  INTEREST_RATE_INCREMENT,
  INTEREST_RATE_MAX,
  INTEREST_RATE_MIN,
  LEVERAGE_FACTOR_MIN,
  LEVERAGE_FACTOR_SUGGESTIONS,
  LTV_RISK,
  MAX_LTV_ALLOWED,
} from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, getDebtBeforeRateBucketIndex, INTEREST_CHART } from "@/src/demo-mode";
import { useAccount } from "@/src/eth/Ethereum";
import { useInputFieldValue } from "@/src/form-utils";
import { usePrice } from "@/src/prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS,
  Dropdown,
  HFlex,
  IconSuggestion,
  InfoTooltip,
  InputField,
  lerp,
  norm,
  PillButton,
  Slider,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { match } from "ts-pattern";
// import { useAction } from "@/src/actions";
import {
  getLeveragedLiquidationPrice,
  getLeverageFactorFromLiquidationPrice,
  getLeverageFactorFromLtv,
  getLiquidationRiskFromLeverageFactor,
  getLtvFromLeverageFactor,
  getRedemptionRisk,
} from "@/src/liquity-math";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function LeverageScreen() {
  const account = useAccount();
  const router = useRouter();
  const ethPriceUsd = usePrice("ETH") ?? dn.from(0, 18);
  const boldPriceUsd = usePrice("BOLD") ?? dn.from(0, 18);

  // const { action, setAction } = useAction();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collateral = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collateral)) {
    throw new Error(`Invalid collateral symbol: ${collateral}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collateral);

  const { collateralRatio } = COLLATERALS[collateralIndex];

  const maxLtv = dn.from(1 / collateralRatio, 18);
  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED);
  const maxLeverageFactor = getLeverageFactorFromLtv(maxLtv);
  const maxLeverageFactorAllowed = getLeverageFactorFromLtv(maxLtvAllowed);
  const mediumRiskLeverageFactor = getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.medium));
  const highRiskLeverageFactor = getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.high));

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral}`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  const ethPriceBold = dn.mul(ethPriceUsd, boldPriceUsd);

  const getLeverageFactorFromLiquidationPriceClamped = (liquidationPrice: Dnum) => {
    const liquidationPriceMin = getLeveragedLiquidationPrice(
      ethPriceBold,
      LEVERAGE_FACTOR_MIN,
      collateralRatio,
    );
    const liquidationPriceMax = getLeveragedLiquidationPrice(
      ethPriceBold,
      maxLeverageFactor,
      collateralRatio,
    );
    const leverageFactor = getLeverageFactorFromLiquidationPrice(
      ethPriceBold,
      liquidationPrice,
      collateralRatio,
    );
    return match([liquidationPrice, leverageFactor])
      .when(([l, f]) => f === 0 || dn.lt(l, liquidationPriceMin), () => LEVERAGE_FACTOR_MIN)
      .when(([l]) => dn.gt(l, liquidationPriceMax), () => maxLeverageFactor)
      .otherwise(() => leverageFactor);
  };

  const leverageFactorSuggestions = useMemo(() => {
    return LEVERAGE_FACTOR_SUGGESTIONS.map((factor) => (
      Math.round(lerp(LEVERAGE_FACTOR_MIN, maxLeverageFactor, factor) * 10) / 10
    ));
  }, [maxLeverageFactor]);

  const [liqPriceFocused, setLiqPriceFocused] = useState(false);
  const [leverageFactor, setLeverageFactor] = useState(LEVERAGE_FACTOR_SUGGESTIONS[0]);

  const depositUsd = deposit.parsed && dn.mul(deposit.parsed, ethPriceUsd);
  const depositBold = deposit.parsed && dn.mul(deposit.parsed, ethPriceBold);
  const leveragedDeposit = deposit.parsed ? dn.mul(deposit.parsed, leverageFactor) : null;
  const totalDebtBold = depositBold && dn.mul(dn.sub(leverageFactor, dn.from(1, 18)), depositBold);

  const ltv = getLtvFromLeverageFactor(leverageFactor);

  const ethLiqPrice = useInputFieldValue((value) => `$ ${dn.format(value)}`, {
    defaultValue: dn.toString(
      getLeveragedLiquidationPrice(
        ethPriceBold,
        leverageFactorSuggestions[0],
        collateralRatio,
      ),
      2,
    ),
    onChange: ({ parsed: price }) => {
      if (price && dn.gt(price, 0)) {
        setLeverageFactor(getLeverageFactorFromLiquidationPriceClamped(price));
      }
    },
    onFocusChange: ({ focus }) => {
      setLiqPriceFocused(focus);

      // recalculate exact liquidation price based on the selected leverage factor
      if (!focus) {
        ethLiqPrice.setValue(dn.toString(
          getLeveragedLiquidationPrice(
            ethPriceBold,
            leverageFactor,
            collateralRatio,
          ),
          2,
        ));
      }
    },
  });

  // update liquidation price when ETH price changes
  const lastEthPriceBold = useRef(ethPriceBold);
  useEffect(() => {
    if (!liqPriceFocused && !dn.eq(ethPriceBold, lastEthPriceBold.current)) {
      ethLiqPrice.setValue(
        dn.toString(getLeveragedLiquidationPrice(ethPriceBold, leverageFactor, collateralRatio), 2),
      );
      lastEthPriceBold.current = ethPriceBold;
    }
  }, [
    collateralRatio,
    ethLiqPrice,
    ethPriceBold,
    leverageFactor,
    liqPriceFocused,
  ]);

  const liquidationRisk = leverageFactor
    ? getLiquidationRiskFromLeverageFactor(
      leverageFactor,
      mediumRiskLeverageFactor,
      highRiskLeverageFactor,
    )
    : null;

  const redemptionRisk = getRedemptionRisk(interestRate.parsed && dn.div(interestRate.parsed, 100));

  const updateLeverageFactor = useCallback((factor: number) => {
    setLeverageFactor(factor);
    ethLiqPrice.setValue(
      dn.toString(getLeveragedLiquidationPrice(ethPriceBold, factor, collateralRatio), 2),
    );
  }, [collateralRatio, ethLiqPrice, ethPriceBold]);

  // reset leverage when collateral changes
  useEffect(() => {
    updateLeverageFactor(leverageFactorSuggestions[0]);
  }, [collateral, leverageFactorSuggestions]);

  const boldInterestPerYear = interestRate.parsed
    && totalDebtBold
    && dn.gt(depositBold, 0)
    && dn.div(totalDebtBold, depositBold);

  const boldRedeemableInFront = dn.format(
    getDebtBeforeRateBucketIndex(
      interestRate.parsed
        ? Math.round((dn.toNumber(interestRate.parsed) - INTEREST_RATE_MIN) / INTEREST_RATE_INCREMENT)
        : 0,
    ),
    { compact: true },
  );

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

  return (
    <Screen
      title={
        <HFlex>
          {content.leverageScreen.headline(
            <TokenIcon.Group>
              {COLLATERALS.map(({ symbol }) => (
                <TokenIcon
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </TokenIcon.Group>,
          )}
        </HFlex>
      }
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
          width: 534,
        })}
      >
        <Field
          // “You deposit”
          field={
            <InputField
              contextual={
                <Dropdown
                  items={COLLATERALS.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected ? dn.format(ACCOUNT_BALANCES[symbol]) : "−",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    setTimeout(() => {
                      deposit.setValue("");
                      deposit.focus();
                    }, 0);
                    router.push(
                      `/leverage/${COLLATERALS[index].symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={collateralIndex}
                />
              }
              label={content.leverageScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: depositUsd && `$${
                  dn.format(depositUsd, {
                    digits: 2,
                    trailingZeros: true,
                  })
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                    onClick={() => {
                      deposit.setValue(dn.toString(ACCOUNT_BALANCES[collateral]));
                    }}
                  />
                ),
              }}
              {...deposit.inputFieldProps}
            />
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoEthPrice ethPriceUsd={ethPriceUsd} />,

            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoMaxLtv maxLtv={dn.div(dn.from(1, 18), collateralRatio)} />,
          ]]}
        />

        <Field
          // ETH Liquidation price
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
                    onChange={(value) => {
                      updateLeverageFactor(
                        Math.round(
                          lerp(LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed, value) * 10,
                        ) / 10,
                      );
                    }}
                    value={norm(
                      leverageFactor,
                      LEVERAGE_FACTOR_MIN,
                      maxLeverageFactorAllowed,
                    )}
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
                    Total debt {totalDebtBold && dn.gt(totalDebtBold, 0)
                      ? (
                        <>
                          <span
                            className={css({
                              fontVariantNumeric: "tabular-nums",
                            })}
                          >
                            {dn.format(totalDebtBold, { digits: 2, trailingZeros: true })}
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
              {...ethLiqPrice.inputFieldProps}
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
                {leveragedDeposit && dn.gt(leveragedDeposit, 0)
                  ? `${
                    dn.format(leveragedDeposit, {
                      digits: 2,
                      trailingZeros: true,
                    })
                  } ETH`
                  : "−"}
              </span>
              <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.exposure)} />
            </HFlex>,
          ]]}
        />

        <VFlex gap={0}>
          <Field
            // “Interest rate”
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
                      gradient={[1 / 3, 2 / 3]}
                      chart={INTEREST_CHART}
                      onChange={(value) => {
                        interestRate.setValue(
                          String(Math.round(lerp(INTEREST_RATE_MIN, INTEREST_RATE_MAX, value) * 10) / 10),
                        );
                      }}
                      value={norm(
                        interestRate.parsed ? dn.toNumber(interestRate.parsed) : 0,
                        INTEREST_RATE_MIN,
                        INTEREST_RATE_MAX,
                      )}
                    />
                  </div>
                }
                label={content.borrowScreen.interestRateField.label}
                placeholder="0.00"
                secondary={{
                  start: (
                    <HFlex gap={4}>
                      <div>
                        {boldInterestPerYear
                          ? dn.format(boldInterestPerYear, { digits: 2, trailingZeros: false })
                          : "−"} BOLD / year
                      </div>
                      <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateBoldPerYear)} />
                    </HFlex>
                  ),
                  end: (
                    <span>
                      <span>{"Before you "}</span>
                      <span
                        className={css({
                          color: "content",
                        })}
                      >
                        <span
                          style={{
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {boldRedeemableInFront}
                        </span>
                        <span>{" BOLD to redeem"}</span>
                      </span>
                    </span>
                  ),
                }}
                {...interestRate.inputFieldProps}
                valueUnfocused={(!interestRate.isEmpty && interestRate.parsed)
                  ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {dn.format(interestRate.parsed, { digits: 1, trailingZeros: true })}
                      </span>
                      <span
                        style={{
                          color: "#878AA4",
                          fontSize: 24,
                        }}
                      >
                        % per year
                      </span>
                    </span>
                  )
                  : null}
              />
            }
            footer={[
              [
                // eslint-disable-next-line react/jsx-key
                <Field.FooterInfoRedemptionRisk riskLevel={redemptionRisk} />,
                <span
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "contentAlt",
                  })}
                >
                  <IconSuggestion size={16} />
                  <span>You can adjust interest rate later</span>
                </span>,
              ],
            ]}
          />
        </VFlex>

        <RedemptionInfo />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            width: "100%",
          }}
        >
          <ConnectWarningBox />
          <Button
            disabled={!allowSubmit}
            label={content.leverageScreen.action}
            mode="primary"
            size="large"
            onClick={() => {
              router.push("/transactions/leverage");
            }}
            wide
          />
        </div>
      </div>
    </Screen>
  );
}
