"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address, Dnum } from "@/src/types";

import { NBSP } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, ETH_MAX_RESERVE, MAX_COLLATERAL_DEPOSITS, MIN_DEBT } from "@/src/constants";
import content from "@/src/content";
import { dnum18, dnumMax, dnumMin } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import {
  getBranch,
  getBranches,
  getCollToken,
  useBranchCollateralRatios,
  useNextOwnerIndex,
  useRedemptionRisk,
} from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalances } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  COLLATERALS as KNOWN_COLLATERALS,
  Dropdown,
  HFlex,
  IconExternal,
  IconSuggestion,
  InfoTooltip,
  InputField,
  isCollateralSymbol,
  PillButton,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { maxUint256 } from "viem";

const KNOWN_COLLATERAL_SYMBOLS = KNOWN_COLLATERALS.map(({ symbol }) => symbol);

export function BorrowScreen() {
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
  const collateral = getCollToken(branch.id);
  const collaterals = branches.map((b) => getCollToken(b.branchId));

  const maxCollDeposit = MAX_COLLATERAL_DEPOSITS[collSymbol];

  const deposit = useInputFieldValue(fmtnum, {
    validate: (parsed, value) => {
      const isAboveMax = parsed && dn.gt(parsed, maxCollDeposit);
      return {
        parsed: isAboveMax ? maxCollDeposit : parsed,
        value: isAboveMax ? dn.toString(maxCollDeposit) : value,
      };
    },
  });

  const debt = useInputFieldValue(fmtnum);

  const [interestRate, setInterestRate] = useState<null | Dnum>(null);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] = useState<Address | null>(null);

  const collPrice = usePrice(collateral.symbol);

  const balances = useBalances(account.address, KNOWN_COLLATERAL_SYMBOLS);
  const collateralRatios = useBranchCollateralRatios(branch.id);

  const collBalance = balances[collateral.symbol];
  if (!collBalance) {
    throw new Error(`Unknown collateral symbol: ${collateral.symbol}`);
  }

  const nextOwnerIndex = useNextOwnerIndex(account.address ?? null, branch.id);
  const redemptionRisk = useRedemptionRisk(branch.id, interestRate);

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collateral.collateralRatio,
    collPrice.data ?? null,
  );

  const debtSuggestions = loanDetails.maxDebt
      && loanDetails.depositUsd
      && loanDetails.deposit
      && dn.gt(loanDetails.deposit, 0)
    ? DEBT_SUGGESTIONS.map((ratio, index) => {
      let debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);

      // debt < MIN_DEBT
      if (debt && dn.lt(debt, MIN_DEBT)) {
        if (index === 0) {
          // if it’s the first suggestion, set it to MIN_DEBT
          debt = MIN_DEBT;
        } else {
          // otherwise don’t show it
          return null;
        }
      }

      const ltv = debt && loanDetails.deposit && collPrice.data && getLtv(
        loanDetails.deposit,
        debt,
        collPrice.data,
      );

      // don’t show if ltv > max LTV
      if (ltv && dn.gt(ltv, loanDetails.maxLtv)) {
        return null;
      }

      const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);

      return { debt, ltv, risk };
    })
    : null;

  const maxAmount = collBalance.data && dnumMin(
    maxCollDeposit,
    dnumMax(
      // Only keep a reserve for ETH, not LSTs
      dn.sub(collBalance.data, collSymbol === "ETH" ? ETH_MAX_RESERVE : 0),
      dnum18(0),
    ),
  );

  const isBelowMinDebt = debt.parsed && !debt.isEmpty && dn.lt(debt.parsed, MIN_DEBT);

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate
    && dn.gt(interestRate, 0)
    && !isBelowMinDebt;

  return (
    <Screen
      heading={{
        title: (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexFlow: "wrap",
              gap: "0 8px",
            })}
          >
            {content.borrowScreen.headline(
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                })}
              >
                <TokenIcon.Group>
                  {collaterals.map(({ symbol }) => (
                    <TokenIcon
                      key={symbol}
                      symbol={symbol}
                    />
                  ))}
                </TokenIcon.Group>
                {NBSP}ETH
              </div>,
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                })}
              >
                <TokenIcon symbol="BOLD" />
                {NBSP}BOLD
              </div>,
            )}
          </div>
        ),
      }}
    >
      <Field
        id="field-deposit"
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
                  const coll = collaterals[index];
                  if (!coll) {
                    throw new Error(`Unknown branch: ${index}`);
                  }

                  deposit.setValue("");
                  router.push(
                    `/borrow/${coll.symbol.toLowerCase()}`,
                    { scroll: false },
                  );
                }}
                selected={branch.id}
              />
            }
            label={content.borrowScreen.depositField.label}
            placeholder="0.00"
            secondary={{
              start: `$${
                deposit.parsed && collPrice.data
                  ? fmtnum(dn.mul(collPrice.data, deposit.parsed), "2z")
                  : "0.00"
              }`,
              end: maxAmount && dn.gt(maxAmount, 0) && (
                <TextButton
                  label={`Max ${fmtnum(maxAmount)} ${collateral.name}`}
                  onClick={() => {
                    deposit.setValue(dn.toString(maxAmount));
                  }}
                />
              ),
            }}
            {...deposit.inputFieldProps}
          />
        }
        footer={{
          start: collPrice.data && (
            <Field.FooterInfoCollPrice
              collPriceUsd={collPrice.data}
              collName={collateral.name}
            />
          ),
          end: (
            <Field.FooterInfoMaxLtv
              maxLtv={loanDetails.maxLtv}
            />
          ),
        }}
      />

      <Field
        id="field-debt"
        field={
          <InputField
            id="input-debt"
            contextual={
              <InputField.Badge
                icon={<TokenIcon symbol="BOLD" />}
                label="BOLD"
              />
            }
            drawer={debt.isFocused || !isBelowMinDebt ? null : {
              mode: "error",
              message: `You must borrow at least ${fmtnum(MIN_DEBT, 2)} BOLD.`,
            }}
            label={content.borrowScreen.borrowField.label}
            placeholder="0.00"
            secondary={{
              start: `$${
                debt.parsed
                  ? fmtnum(debt.parsed)
                  : "0.00"
              }`,
              end: debtSuggestions && (
                <HFlex gap={6}>
                  {debtSuggestions.map((s) => (
                    s?.debt && s?.risk && (
                      <PillButton
                        key={dn.toString(s.debt)}
                        label={fmtnum(s.debt, {
                          compact: true,
                          digits: 0,
                          prefix: "$",
                        })}
                        onClick={() => {
                          if (s.debt) {
                            debt.setValue(dn.toString(s.debt, 0));
                          }
                        }}
                        warnLevel={s.risk}
                      />
                    )
                  ))}
                </HFlex>
              ),
            }}
            {...debt.inputFieldProps}
          />
        }
        footer={[
          {
            start: (
              <Field.FooterInfoLiquidationRisk
                riskLevel={loanDetails.liquidationRisk}
              />
            ),
            end: (
              <Field.FooterInfoLiquidationPrice
                liquidationPrice={loanDetails.liquidationPrice}
              />
            ),
          },
          {
            end: (
              <Field.FooterInfoLoanToValue
                ltvRatio={loanDetails.ltv}
                maxLtvRatio={loanDetails.maxLtv}
              />
            ),
          },
        ]}
      />

      <Field
        id="field-interest-rate"
        field={
          <InterestRateField
            branchId={branch.id}
            debt={debt.parsed}
            delegate={interestRateDelegate}
            inputId="input-interest-rate"
            interestRate={interestRate}
            mode={interestRateMode}
            onAverageInterestRateLoad={setInterestRate}
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

      {collateralRatios.data?.isBelowCcr && collateralRatios.data?.tcr && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 16,
            fontSize: 16,
            color: "content",
            background: "infoSurface",
            border: "1px solid token(colors.infoSurfaceBorder)",
            borderRadius: 8,
          })}
        >
          <div
            className={css({
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 12,
            })}
          >
            Borrowing Restrictions Active
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 15,
              medium: {
                fontSize: 14,
              },
            })}
          >
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              })}
            >
              <span>Current TCR:</span>
              <Amount
                value={collateralRatios.data.tcr}
                percentage
                format={0}
              />
            </div>
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              })}
            >
              <span>Critical Threshold (CCR):</span>
              <Amount
                value={collateralRatios.data.ccr}
                percentage
                format={0}
              />
            </div>
          </div>
          <div
            className={css({
              marginTop: 12,
              fontSize: 15,
              color: "contentAlt",
              lineHeight: 1.4,
              medium: {
                fontSize: 14,
              },
            })}
          >
            <div className={css({ marginBottom: 8 })}>
              When the branch TCR falls below the CCR, these restrictions apply:
            </div>
            <ul
              className={css({
                margin: 0,
                marginBottom: 8,
                listStyle: "none",
              })}
            >
              <li
                className={css({
                  position: "relative",
                  paddingLeft: 12,
                  "&::before": {
                    content: "\"•\"",
                    position: "absolute",
                    left: 0,
                    color: "contentAlt",
                  },
                })}
              >
                Opening a position: only allowed if resulting TCR {">"}{" "}
                <Amount value={collateralRatios.data.ccr} percentage format={0} />
              </li>
              <li
                className={css({
                  position: "relative",
                  paddingLeft: 12,
                  "&::before": {
                    content: "\"•\"",
                    position: "absolute",
                    left: 0,
                    color: "contentAlt",
                  },
                })}
              >
                New borrowing: must bring resulting TCR {">"}{" "}
                <Amount value={collateralRatios.data.ccr} percentage format={0} />
              </li>
              <li
                className={css({
                  position: "relative",
                  paddingLeft: 12,
                  "&::before": {
                    content: "\"•\"",
                    position: "absolute",
                    left: 0,
                    color: "contentAlt",
                  },
                })}
              >
                Collateral withdrawal: must be matched by debt repayment
              </li>
            </ul>
          </div>
          <LinkTextButton
            href="https://docs.liquity.org/v2-faq/borrowing-and-liquidations#docs-internal-guid-fee4cc44-7fff-c866-9ccf-bac2da1b5222"
            rel="noopener noreferrer"
            target="_blank"
            label={
              <span
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "accent",
                  fontSize: 15,
                  medium: {
                    fontSize: 16,
                  },
                })}
              >
                <span>Learn more about borrowing restrictions</span>
                <IconExternal size={16} />
              </span>
            }
          />
        </div>
      )}

      <FlowButton
        disabled={!allowSubmit}
        label={content.borrowScreen.action}
        request={interestRate
            && deposit.parsed
            && debt.parsed
            && account.address
            && typeof nextOwnerIndex.data === "number"
          ? {
            flowId: "openBorrowPosition",
            backLink: [
              `/borrow/${collSymbol.toLowerCase()}`,
              "Back to editing",
            ],
            successLink: ["/", "Go to the Dashboard"],
            successMessage: "The position has been created successfully.",

            branchId: branch.id,
            owner: account.address,
            ownerIndex: nextOwnerIndex.data,
            collAmount: deposit.parsed,
            boldAmount: debt.parsed,
            annualInterestRate: interestRate,
            maxUpfrontFee: dnum18(maxUint256),
            interestRateDelegate: interestRateMode === "manual" || !interestRateDelegate
              ? null
              : interestRateDelegate,
          }
          : undefined}
      />
    </Screen>
  );
}
