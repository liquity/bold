"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address, Dnum, PositionLoanUncommitted } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { ETH_MAX_RESERVE, LEVERAGE_FACTOR_DEFAULT, MAX_COLLATERAL_DEPOSITS } from "@/src/constants";
import content from "@/src/content";
import { dnum18, DNUM_0, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import {
  getBranch,
  getBranches,
  getCollToken,
  useNextOwnerIndex,
  useRedemptionRiskOfInterestRate,
} from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalances } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  ADDRESS_ZERO,
  Dropdown,
  HFlex,
  IconSuggestion,
  InfoTooltip,
  InputField,
  isCollateralSymbol,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function LeverageScreen() {
  const branches = getBranches();

  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = `${useParams().collateral ?? branches[0]?.symbol}`.toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const router = useRouter();
  const account = useAccount();

  const branch = getBranch(collSymbol);
  const collaterals = branches.map((b) => getCollToken(b.branchId));
  const collateral = getCollToken(branch.id);
  const collPrice = usePrice(collateral.symbol);
  const collateralSymbols = collaterals.map((collateral) => collateral.symbol);
  const balances = useBalances(account.address, collateralSymbols);

  const nextOwnerIndex = useNextOwnerIndex(account.address ?? null, branch.id);

  const maxCollDeposit = MAX_COLLATERAL_DEPOSITS[collSymbol] ?? null;
  const depositPreLeverage = useInputFieldValue(fmtnum, {
    validate: (parsed, value) => {
      const isAboveMax = maxCollDeposit && parsed && dn.gt(parsed, maxCollDeposit);
      return {
        parsed: isAboveMax ? maxCollDeposit : parsed,
        value: isAboveMax ? dn.toString(maxCollDeposit) : value,
      };
    },
  });

  const [interestRate, setInterestRate] = useState<null | Dnum>(null);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] = useState<Address | null>(null);

  const setInterestRateRounded = useCallback((averageInterestRate: Dnum, setValue: (value: string) => void) => {
    const rounded = dn.div(dn.round(dn.mul(averageInterestRate, 1e4)), 1e4);
    setValue(dn.toString(dn.mul(rounded, 100)));
  }, []);

  const leverageField = useLeverageField({
    positionDeposit: depositPreLeverage.parsed,
    positionDebt: DNUM_0,
    collPrice: collPrice.data ?? null,
    collToken: collateral,
    defaultLeverageFactorAdjustment: LEVERAGE_FACTOR_DEFAULT - 1,
  });

  const redemptionRisk = useRedemptionRiskOfInterestRate(branch.id, interestRate ?? DNUM_0);
  const depositUsd = depositPreLeverage.parsed && collPrice.data && dn.mul(
    depositPreLeverage.parsed,
    collPrice.data,
  );

  const collBalance = balances[collateral.symbol]?.data;

  const maxAmount = collBalance && dnumMax(
    dn.sub(collBalance, collSymbol === "ETH" ? ETH_MAX_RESERVE : 0), // Only keep a reserve for ETH, not LSTs
    dnum18(0),
  );

  const newLoan: PositionLoanUncommitted = {
    type: "multiply",
    status: "active",
    batchManager: interestRateDelegate,
    borrowed: leverageField.debt ?? dn.from(0, 18),
    borrower: account.address ?? ADDRESS_ZERO,
    branchId: branch.id,
    deposit: depositPreLeverage.parsed
      ? dn.mul(depositPreLeverage.parsed, leverageField.leverageFactor)
      : dn.from(0, 18),
    interestRate: interestRate ?? dn.from(0, 18),
    troveId: null,
  };

  const hasDeposit = Boolean(depositPreLeverage.parsed && dn.gt(depositPreLeverage.parsed, 0));

  const allowSubmit = account.isConnected
    && hasDeposit
    && leverageField.isValid;

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.leverageScreen.headline(
              <TokenIcon.Group>
                {collaterals.map(({ symbol }) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
            )}
          </HFlex>
        ),
      }}
    >
      <Field
        field={
          <InputField
            id="input-deposit"
            contextual={
              <Dropdown
                items={collaterals.map(({ symbol, name }) => ({
                  icon: <TokenIcon symbol={symbol} />,
                  label: name,
                  value: account.isConnected
                    ? fmtnum(balances[symbol]?.data ?? 0)
                    : "−",
                }))}
                menuPlacement="end"
                menuWidth={300}
                onSelect={(index) => {
                  setTimeout(() => {
                    depositPreLeverage.setValue("");
                    depositPreLeverage.focus();
                  }, 0);
                  const collToken = collaterals[index];
                  if (!collToken) {
                    throw new Error(`Unknown branch: ${index}`);
                  }
                  const { symbol } = collToken;
                  router.push(
                    `/multiply/${symbol.toLowerCase()}`,
                    { scroll: false },
                  );
                }}
                selected={branch.id}
              />
            }
            label={content.leverageScreen.depositField.label}
            placeholder="0.00"
            secondary={{
              start: fmtnum(depositUsd, { prefix: "$", preset: "2z" }),
              end: maxAmount
                ? (
                  <TextButton
                    label={`Max ${fmtnum(maxAmount)} ${collateral.name}`}
                    onClick={() => {
                      depositPreLeverage.setValue(dn.toString(maxAmount));
                    }}
                  />
                )
                : "Fetching balance…",
            }}
            {...depositPreLeverage.inputFieldProps}
          />
        }
        footer={{
          start: collPrice.data && (
            <Field.FooterInfoCollPrice
              collName={collateral.name}
              collPriceUsd={collPrice.data}
            />
          ),
          end: (
            <Field.FooterInfoMaxLtv
              maxLtv={dn.div(dn.from(1, 18), collateral.collateralRatio)}
            />
          ),
        }}
      />

      <Field
        field={<LeverageField inputId="input-liquidation-price" {...leverageField} />}
        footer={[
          {
            start: <Field.FooterInfoLiquidationRisk riskLevel={leverageField.liquidationRisk} />,
            end: <Field.FooterInfoLoanToValue ltvRatio={leverageField.ltv} maxLtvRatio={leverageField.maxLtv} />,
          },
          {
            start: (
              <Field.FooterInfoPriceImpact
                inputTokenName="BOLD"
                outputTokenName={collateral.name}
                priceImpact={leverageField.priceImpact}
              />
            ),

            end: (
              <Field.FooterInfo
                label="Exposure"
                value={
                  <HFlex gap={4}>
                    <div
                      className={css({
                        flexShrink: 1,
                        display: "flex",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      <Amount
                        value={leverageField.deposit && dn.gt(leverageField.deposit, 0)
                          ? leverageField.deposit
                          : null}
                        format="2z"
                        fallback="−"
                        suffix={` ${collateral.name}`}
                      />
                    </div>
                    <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.exposure)} />
                  </HFlex>
                }
              />
            ),
          },
          {
            start: (
              <Field.FooterInfoSlippageRefundLeverUp
                slippageProtection={leverageField.slippageProtection}
                collateralName={collateral.name}
              />
            ),
          },
        ]}
      />

      <Field
        field={
          <InterestRateField
            branchId={branch.id}
            debt={leverageField.debt}
            delegate={interestRateDelegate}
            inputId="input-interest-rate"
            interestRate={interestRate}
            mode={interestRateMode}
            onAverageInterestRateLoad={setInterestRateRounded}
            onChange={setInterestRate}
            onDelegateChange={setInterestRateDelegate}
            onModeChange={setInterestRateMode}
          />
        }
        footer={{
          start: (
            <Field.FooterInfoRedemptionRisk
              riskLevel={redemptionRisk.data ?? null}
            />
          ),
          end: (
            <div
              className={css({
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "contentAlt",
                fontSize: 14,
              })}
            >
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                })}
              >
                <IconSuggestion size={16} />
              </div>
              <div
                className={css({
                  flexShrink: 1,
                  display: "inline",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                You can adjust this rate at any time
              </div>
              <div
                className={css({
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                })}
              >
                <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateAdjustment)} />
              </div>
            </div>
          ),
        }}
      />

      <RedemptionInfo />

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
          width: "100%",
        })}
      >
        {/*<ConnectWarningBox />*/}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
          })}
        >
          <FlowButton
            disabled={!allowSubmit}
            label={content.leverageScreen.action}
            request={
              // depositPreLeverage.parsed
              // && leverageField.debt
              // && account.address
              typeof nextOwnerIndex.data === "number"
                ? {
                  flowId: "openLeveragePosition",
                  backLink: [`/multiply/${collSymbol.toLowerCase()}`, "Back to editing"],
                  successLink: ["/", "Go to the Dashboard"],
                  successMessage: "The leveraged position has been created successfully.",

                  ownerIndex: nextOwnerIndex.data,
                  loan: newLoan,
                  initialDeposit: depositPreLeverage.parsed ?? DNUM_0,
                  flashloanAmount: leverageField.depositChange ?? DNUM_0,
                  boldAmount: leverageField.debtChange ?? DNUM_0,
                }
                : undefined
            }
          />
        </div>
      </div>
    </Screen>
  );
}
