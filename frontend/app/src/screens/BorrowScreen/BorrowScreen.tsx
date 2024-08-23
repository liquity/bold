"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, getDebtBeforeRateBucketIndex, INTEREST_CHART } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { useFindAvailableTroveIndex } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
// import { useAccount } from "@/src/services/Ethereum";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
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
import { match, P } from "ts-pattern";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function BorrowScreen() {
  const account = useAccount();

  const {
    currentStepIndex,
    discard,
    signAndSend,
    start,
    flow,
  } = useTransactionFlow();

  const availableTroveIndex = useFindAvailableTroveIndex(account.address);
  const openedTroveIndex = (availableTroveIndex.data ?? 0) - 1;

  const router = useRouter();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collSymbol = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collSymbol);
  const collateral = COLLATERALS[collateralIndex];

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral.name}`);
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  const collPrice = usePrice(collateral.symbol);

  if (!collPrice) {
    return null;
  }

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate.parsed && dn.div(interestRate.parsed, 100),
    collateral.collateralRatio,
    collPrice,
  );

  const debtSuggestions = loanDetails.maxDebt
      && loanDetails.depositUsd
      && loanDetails.deposit
      && dn.gt(loanDetails.deposit, 0)
    ? DEBT_SUGGESTIONS.map((ratio) => {
      const debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);
      const ltv = debt && loanDetails.deposit && getLtv(loanDetails.deposit, debt, collPrice);
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

  const currentStepId = flow?.steps?.[currentStepIndex]?.id;

  const txMode = false;

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
      {txMode && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
          })}
        >
          <div>
            <div>
              next available trove: {match(availableTroveIndex)
                .with({ status: "idle" }, () => "−")
                .with({ status: "loading" }, () => "fetching")
                .with({ status: "error" }, () => "error")
                .with({ status: "success" }, ({ data }) => `#${data}`)
                .exhaustive()}
            </div>
            <div>flow: {flow?.request.flowId}</div>
            <div>
              flow steps:{" "}
              {flow?.steps && <>[{flow?.steps.map(({ id, txHash }) => txHash ? `${id} (ok)` : id).join(", ")}]</>}
            </div>
            <div>
              current flow step: {currentStepIndex} ({flow?.steps && flow?.steps[currentStepIndex]?.id})
            </div>
            <div>
              flow step error: <pre>{flow?.steps?.[currentStepIndex]?.error}</pre>
            </div>
          </div>
          {match([account, availableTroveIndex])
            .with([
              { status: "connected", address: P.nonNullable },
              { status: "success" },
            ], ([
              account,
              availableTroveIndex,
            ]) => (
              (
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      gap: 16,
                    })}
                  >
                    <Button
                      size="mini"
                      label={`openLoanPosition (#${availableTroveIndex.data})`}
                      onClick={() => {
                        start({
                          flowId: "openLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: availableTroveIndex.data,
                          collAmount: dn.from(25, 18),
                          boldAmount: dn.from(2800, 18),
                          upperHint: dn.from(0, 18),
                          lowerHint: dn.from(0, 18),
                          annualInterestRate: dn.from(0.05, 18),
                          maxUpfrontFee: dn.from(100, 18),
                        });
                      }}
                    />
                    <Button
                      disabled={openedTroveIndex < 0}
                      label={`updateLoanPosition (#${availableTroveIndex.data - 1})`}
                      onClick={() => {
                        start({
                          flowId: "updateLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: availableTroveIndex.data - 1,
                          collChange: dn.from(1, 18),
                          boldChange: dn.from(0, 18),
                          maxUpfrontFee: dn.from(100, 18),
                        });
                      }}
                      size="mini"
                    />
                    <Button
                      disabled={openedTroveIndex < 0}
                      label={`repayAndCloseLoanPosition (#${availableTroveIndex.data - 1})`}
                      onClick={() => {
                        start({
                          flowId: "repayAndCloseLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: availableTroveIndex.data - 1,
                        });
                      }}
                      size="mini"
                    />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      gap: 16,
                    })}
                  >
                    <Button
                      size="mini"
                      label="discard"
                      onClick={discard}
                      disabled={!flow}
                    />
                    <Button
                      size="mini"
                      label={`sign & send${currentStepId ? ` (${currentStepId})` : ""}`}
                      onClick={() => {
                        if (currentStepIndex >= 0) {
                          signAndSend();
                        }
                      }}
                      disabled={!flow || currentStepIndex < 0}
                    />
                  </div>
                </div>
              )
            ))
            .otherwise(() => null)}
        </div>
      )}
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
                    ? dn.format(dn.mul(collPrice, deposit.parsed), { digits: 2, trailingZeros: true })
                    : "0.00"
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${dn.format(ACCOUNT_BALANCES[collateral.symbol])} ${collateral.name}`}
                    onClick={() => {
                      deposit.setValue(
                        dn.format(ACCOUNT_BALANCES[collateral.symbol]).replace(",", ""),
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
              <Field.FooterInfoCollPrice
                collPriceUsd={collPrice}
                collName={collateral.name}
              />,

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
                    ? dn.format(dn.mul(collPrice, debt.parsed), {
                      digits: 2,
                      trailingZeros: true,
                    })
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
                liquidationPrice={loanDetails.liquidationPrice}
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
