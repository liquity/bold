"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, getDebtBeforeRateBucketIndex, INTEREST_CHART } from "@/src/demo-mode";
import { useAccount } from "@/src/eth/Ethereum";
import { useInputFieldValue } from "@/src/form-utils";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
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
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function BorrowScreen() {
  // const demoMode = useDemoMode();
  const account = useAccount();

  const router = useRouter();
  const ethPriceUsd = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collateral = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collateral)) {
    throw new Error(`Invalid collateral symbol: ${collateral}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collateral);
  const { collateralRatio } = COLLATERALS[collateralIndex];

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral}`);
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  if (!ethPriceUsd || !boldPriceUsd) {
    return null;
  }

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate.parsed && dn.div(interestRate.parsed, 100),
    dn.div(dn.from(1, 18), collateralRatio),
    ethPriceUsd,
  );

  const debtSuggestions = loanDetails.maxDebt
      && loanDetails.depositUsd
      && loanDetails.deposit
      && dn.gt(loanDetails.deposit, 0)
    ? DEBT_SUGGESTIONS.map((ratio) => {
      const debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);
      const ltv = debt && loanDetails.depositUsd && getLtv(debt, loanDetails.depositUsd);
      const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);
      return { debt, ltv, risk };
    })
    : null;

  const boldInterestPerYear = interestRate.parsed
    && debt.parsed
    && dn.mul(debt.parsed, dn.div(interestRate.parsed, 100));

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
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

  return (
    <Screen
      title={
        <HFlex>
          {content.borrowScreen.headline(
            <TokenIcon.Group>
              {COLLATERALS.map(({ symbol }) => (
                <TokenIcon
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </TokenIcon.Group>,
            <TokenIcon symbol="BOLD" />,
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
                    deposit.setValue("");
                    router.push(
                      `/borrow/${COLLATERALS[index].symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={collateralIndex}
                />
              }
              label={content.borrowScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: `$${
                  deposit.parsed
                    ? dn.format(dn.mul(ethPriceUsd, deposit.parsed), { digits: 2, trailingZeros: true })
                    : "0.00"
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                    onClick={() => {
                      deposit.setValue(
                        dn.format(ACCOUNT_BALANCES[collateral]).replace(",", ""),
                      );
                    }}
                  />
                ),
              }}
              {...deposit.inputFieldProps}
            />
          }
          footer={[
            [
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoEthPrice ethPriceUsd={ethPriceUsd} />,

              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoMaxLtv maxLtv={loanDetails.maxLtv} />,
            ],
          ]}
        />

        <Field
          // “You borrow”
          field={
            <InputField
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              label={content.borrowScreen.borrowField.label}
              placeholder="0.00"
              secondary={{
                start: `$${
                  debt.parsed
                    ? dn.gt(dn.mul(boldPriceUsd, debt.parsed), 1_000_000_000_000)
                      ? "−"
                      : dn.format(
                        dn.mul(boldPriceUsd, debt.parsed),
                        { digits: 2, trailingZeros: true, compact: dn.gt(debt.parsed, 1_000_000_000) },
                      )
                    : "0.00"
                }`,
                end: debtSuggestions && (
                  <HFlex gap={6}>
                    {debtSuggestions.map((s) => (
                      s.debt && s.risk && (
                        <PillButton
                          key={dn.toString(s.debt)}
                          label={`$${dn.format(s.debt, { compact: true, digits: 0 })}`}
                          onClick={() => {
                            if (s.debt) {
                              debt.setValue(dn.toString(s.debt, 0));
                            }
                          }}
                          warnLevel={s.risk}
                        />
                      )
                    ))}
                    {debtSuggestions.length > 0 && (
                      <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateSuggestions)} />
                    )}
                  </HFlex>
                ),
              }}
              {...debt.inputFieldProps}
            />
          }
          footer={[
            [
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoLiquidationRisk
                riskLevel={loanDetails.liquidationRisk}
              />,
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoLiquidationPrice
                liquidationPrice={loanDetails.liquidationPriceUsd}
              />,
            ],
            [
              null,
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoLoanToValue
                ltvRatio={loanDetails.ltv}
                maxLtvRatio={loanDetails.maxLtv}
              />,
            ],
          ]}
        />

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
              <Field.FooterInfoRedemptionRisk riskLevel={loanDetails.redemptionRisk} />,
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
            label={content.borrowScreen.action}
            mode="primary"
            size="large"
            wide
            onClick={() => {
              router.push("/transactions/borrow");
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
