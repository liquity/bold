"use client";

import type { PositionLoan } from "@/src/types";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Position } from "@/src/comps/Position/Position";
import { Screen } from "@/src/comps/Screen/Screen";
import { ACCOUNT_BALANCES, ACCOUNT_POSITIONS, ETH_PRICE } from "@/src/demo-data";
import { useInputFieldValue } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Dropdown,
  HFlex,
  IconGas,
  InfoTooltip,
  InputField,
  PillButton,
  Tabs,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useMemo } from "react";

const TABS = [
  { label: "Update position", id: "update" },
  { label: "Repay & Close", id: "close" },
];

export function LoanScreen() {
  const router = useRouter();
  const action = useSelectedLayoutSegment() ?? "update";

  const searchParams = useSearchParams();
  const troveId = searchParams.get("id");

  const tab = TABS.findIndex(({ id }) => id === action);

  const trove = useMemo(() => {
    if (troveId === null) {
      return null;
    }
    let troveIdInt: bigint;
    try {
      troveIdInt = BigInt(troveId);
    } catch {
      return null;
    }
    const position = ACCOUNT_POSITIONS.find((position) => (
      position.type === "loan" && position.troveId === troveIdInt
    ));
    return position as PositionLoan | null;
  }, [troveId]);

  if (!trove) {
    notFound();
  }

  return (
    <Screen>
      <VFlex gap={48}>
        <Position troveId={trove.troveId} />
        <VFlex gap={40}>
          <Tabs
            items={TABS.map(({ label, id }) => ({
              label,
              panelId: `p-${id}`,
              tabId: `t-${id}`,
            }))}
            selected={tab}
            onSelect={(index) => {
              router.push(`/loan/${TABS[index].id}?id=${troveId}`);
            }}
          />
          {action === "update" && <UpdatePositionPanel />}
          {action === "close" && <ClosePositionPanel loan={trove} />}
        </VFlex>
      </VFlex>
    </Screen>
  );
}

function UpdatePositionPanel() {
  const deposit = useInputFieldValue((value) => `${dn.format(value)} ETH`);
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)} %`);

  const depositUsd = dn.mul(deposit.parsed ?? 0, ETH_PRICE);
  const debtLtv = debt.parsed && dn.gt(depositUsd, 0)
    ? dn.div(dn.mul(debt.parsed, 100), depositUsd)
    : null;

  return (
    <>
      <VFlex gap={48}>
        <Field
          field={
            <InputField
              action={
                <InputTokenBadge
                  icon={<TokenIcon symbol="ETH" />}
                  label="ETH"
                />
              }
              label="Deposit"
              placeholder="0.00"
              secondaryStart={deposit.parsed
                ? "$" + dn.format(depositUsd, 2)
                : "$0.00"}
              secondaryEnd={
                <TextButton
                  label={`Max. ${dn.format(ACCOUNT_BALANCES.eth, 2)} ETH`}
                  onClick={() => {
                    deposit.setValue(
                      dn.toString(ACCOUNT_BALANCES.eth),
                    );
                  }}
                />
              }
              {...deposit.inputFieldProps}
            />
          }
          footerEnd={
            <Field.FooterInfo
              label="Max. LTV"
              value={
                <HFlex gap={4}>
                  <div>80.00%</div>
                  <InfoTooltip heading="Max. LTV">
                    The maximum Loan-to-Value ratio allowed by the system.
                  </InfoTooltip>
                </HFlex>
              }
            />
          }
        />
        <Field
          field={
            <InputField
              action={
                <InputTokenBadge
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              label="Debt"
              placeholder="0.00"
              secondaryStart={debt.parsed ? "$" + dn.format(debt.parsed, 2) : "$0.00"}
              secondaryEnd={
                <HFlex gap={8}>
                  Max LTV 80%:
                  <TextButton
                    label={`${dn.format(dn.mul(depositUsd, 0.8), 2)} BOLD`}
                    onClick={() => {
                      debt.setValue(dn.toString(dn.mul(depositUsd, 0.8), 2));
                    }}
                  />
                </HFlex>
              }
              {...debt.inputFieldProps}
            />
          }
          footerStart={
            <VFlex gap={4}>
              <Field.FooterInfoWarnLevel
                label="Low liquidation risk"
                level="low"
              />
              <Field.FooterInfo
                label="LTV"
                value={
                  <HFlex gap={4}>
                    <span
                      className={css({
                        "--color-negative": "token(colors.negative)",
                      })}
                      style={{
                        color: "",
                      }}
                    >
                      {debtLtv
                        ? dn.format(debtLtv, 2)
                        : "0.00"}%
                    </span>
                    <InfoTooltip heading="Loan-to-Value ratio">
                      Loan-to-Value ratio is the ratio of the debt to the collateral value.
                    </InfoTooltip>
                  </HFlex>
                }
              />
            </VFlex>
          }
          footerEnd={
            <VFlex gap={4} alignItems="flex-end">
              <Field.FooterInfo
                label="ETH Price"
                value={`$${dn.format(ETH_PRICE, 2)}`}
              />
              <Field.FooterInfo
                label="Liquidation Price"
                value={`$${dn.format(ETH_PRICE, 2)}`}
              />
            </VFlex>
          }
        />
        <Field
          // “Interest rate”
          field={
            <InputField
              action={<InputTokenBadge label="% per year" />}
              label="Interest rate"
              placeholder="0.00"
              secondaryStart={
                <HFlex gap={4}>
                  <div>0 BOLD / year</div>
                  <InfoTooltip heading="Interest rate">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
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
                  <InfoTooltip heading="Interest rate">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
                </HFlex>
              }
              {...interestRate.inputFieldProps}
            />
          }
          footerStart={
            <Field.FooterInfoWarnLevel
              label="Low redemption risk"
              level="low"
            />
          }
        />
      </VFlex>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          disabled={!(deposit.parsed && dn.gt(deposit.parsed, 0))}
          label="Update position"
          mode="primary"
          size="large"
          wide
        />
      </div>
    </>
  );
}

function ClosePositionPanel({
  loan,
}: {
  loan: PositionLoan;
}) {
  return (
    <>
      <VFlex gap={48}>
        <Field
          field={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                <div>
                  {dn.format(loan.borrowed, { digits: 2, trailingZeros: true })}
                </div>
              </div>
              <TokensDropdown selected={0} setSelected={() => {}} />
            </div>
          }
          footerStart={
            <Field.FooterInfo
              label={`$${dn.format(loan.borrowed, 2)}`}
              value={null}
            />
          }
          label="You repay with"
        />
        <Field
          field={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                <div>
                  {dn.format([1n, 0], { digits: 2, trailingZeros: true })}
                </div>
              </div>
              <div>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 24,
                  })}
                >
                  <TokenIcon symbol="ETH" />
                  <div>ETH</div>
                </div>
              </div>
            </div>
          }
          label="You reclaim"
        />
      </VFlex>
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          color: "contentAlt",
        })}
      >
        <HFlex gap={8}>
          <IconGas />
          Gas
        </HFlex>
        <VFlex gap={12}>
          <div
            className={css({
              color: "content",
            })}
          >
            0.01 ETH
          </div>
          <div>~$32.06</div>
        </VFlex>
      </div>
      <div
        className={css({
          padding: 20,
          textAlign: "center",
          background: "yellow:200",
          borderRadius: 8,
        })}
      >
        You are repaying your debt and closing the position.<br />The deposit will be returned to your wallet.
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          label="Repay & close"
          mode="primary"
          size="large"
          wide
        />
      </div>
    </>
  );
}

function InputTokenBadge({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        fontSize: 24,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      })}
      style={{
        paddingLeft: icon ? 8 : 16,
      }}
    >
      {icon}
      <div>
        {label}
      </div>
    </div>
  );
}

function TokensDropdown({
  selected,
  setSelected,
}: {
  selected: number;
  setSelected: (index: number) => void;
}) {
  return (
    <Dropdown
      items={([
        "BOLD",
        "ETH",
      ] as const).map((symbol) => ({
        icon: <TokenIcon symbol={symbol} />,
        label: symbol,
      }))}
      menuWidth={300}
      onSelect={setSelected}
      selected={selected}
    />
  );
}
