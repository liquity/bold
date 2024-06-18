"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Forecast } from "@/src/comps/Forecast/Forecast";
import { Screen } from "@/src/comps/Screen/Screen";
import { LEVERAGE_FACTOR_MIN, LEVERAGE_FACTOR_SUGGESTIONS, LTV_RISK, MAX_LTV_ALLOWED } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES } from "@/src/demo-data";
import { useInputFieldValue } from "@/src/form-utils";
import { lerp, norm } from "@/src/math-utils";
import { usePrice } from "@/src/prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS,
  Dropdown,
  HFlex,
  IconChevronSmallUp,
  InfoTooltip,
  InputField,
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
// import { useAccount } from "wagmi";
import { useDemoState } from "@/src/demo-state";
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
  const { account, setDemoState } = useDemoState();
  // const account = useAccount();
  const router = useRouter();
  const ethPriceUsd = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");
  const ethPriceBold = dn.mul(ethPriceUsd, boldPriceUsd);

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
    return match(liquidationPrice)
      .when((l) => dn.lt(l, liquidationPriceMin), () => LEVERAGE_FACTOR_MIN)
      .when((l) => dn.gt(l, liquidationPriceMax), () => maxLeverageFactor)
      .otherwise(() => leverageFactor);
  };

  const leverageFactorSuggestions = useMemo(() => {
    return LEVERAGE_FACTOR_SUGGESTIONS.map((factor) => (
      Math.round(lerp(LEVERAGE_FACTOR_MIN, maxLeverageFactor, factor) * 10) / 10
    ));
  }, [maxLeverageFactor]);

  const [liqPriceFocused, setLiqPriceFocused] = useState(false);
  const [leverageFactor, setLeverageFactor] = useState(() => (
    getLeverageFactorFromLiquidationPriceClamped(
      getLeveragedLiquidationPrice(ethPriceBold, leverageFactorSuggestions[0], collateralRatio),
    )
  ));

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
      if (price) {
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

  const [showForecast, setShowForecast] = useState(false);

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
              action={
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
              secondaryStart={depositUsd && `$${
                dn.format(depositUsd, {
                  digits: 2,
                  trailingZeros: true,
                })
              }`}
              secondaryEnd={account.isConnected && (
                <TextButton
                  label={`Max ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                  onClick={() => {
                    deposit.setValue(dn.toString(ACCOUNT_BALANCES[collateral]));
                  }}
                />
              )}
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
              action={
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 300,
                  }}
                >
                  <Slider
                    gradientMode={[
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
              label={content.leverageScreen.liquidationPriceField.label}
              actionLabel={
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
              }
              placeholder="0.00"
              secondaryStart={
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
              }
              secondaryEnd={
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
              }
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
                action={<StaticAction label="% per year" />}
                label={content.leverageScreen.interestRateField.label}
                placeholder="0.00"
                secondaryStart={
                  <HFlex gap={4}>
                    <div>
                      {interestRate.parsed && totalDebtBold
                        ? dn.format(dn.mul(dn.div(interestRate.parsed, 100), totalDebtBold), {
                          digits: 2,
                          trailingZeros: true,
                        })
                        : "−"} BOLD / year
                    </div>
                    <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateBoldPerYear)} />
                  </HFlex>
                }
                secondaryEnd={
                  <HFlex gap={6}>
                    <PillButton
                      label="6.5%"
                      onClick={() => interestRate.setValue("6.5")}
                      warnLevel="low"
                    />
                    <PillButton
                      label="5.0%"
                      onClick={() => interestRate.setValue("5.0")}
                      warnLevel="medium"
                    />
                    <PillButton
                      label="3.5%"
                      onClick={() => interestRate.setValue("3.5")}
                      warnLevel="high"
                    />
                    <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateSuggestions)} />
                  </HFlex>
                }
                {...interestRate.inputFieldProps}
              />
            }
            footer={[[
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoRedemptionRisk riskLevel={redemptionRisk} />,

              // eslint-disable-next-line react/jsx-key
              <TextButton
                onClick={() => setShowForecast(!showForecast)}
                label={
                  <>
                    <div>
                      Redemption forecast
                    </div>
                    <div
                      className={css({
                        transform: showForecast ? "rotate(0)" : "rotate(180deg)",
                        transition: "transform 150ms",
                      })}
                    >
                      <IconChevronSmallUp size={14} />
                    </div>
                  </>
                }
              />,
            ]]}
          />
          <Forecast opened={showForecast} />
        </VFlex>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            width: "100%",
          }}
        >
          {!account.isConnected && (
            <div
              className={css({
                paddingTop: 16,
              })}
            >
              <div
                className={css({
                  padding: "20px 24px",
                  textAlign: "center",
                  background: "secondary",
                  borderRadius: 8,
                })}
              >
                Please{" "}
                <TextButton
                  label="connect"
                  onClick={() => {
                    setDemoState({
                      account: { isConnected: true },
                    });
                  }}
                />{" "}
                your wallet to continue.
              </div>
            </div>
          )}
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

function StaticAction({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        paddingLeft: icon ? 8 : 16,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      }}
    >
      {icon}
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}
