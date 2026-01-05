import type { PositionLoanCommitted } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { ErrorBox } from "@/src/comps/ErrorBox/ErrorBox";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { LEVERAGE_SLIPPAGE_TOLERANCE } from "@/src/constants";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { useQuoteExactOutput } from "@/src/liquity-leverage";
import { getBranch, getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { addressesEqual, BOLD, Dropdown, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function PanelClosePosition({
  loan,
  loanMode,
}: {
  loan: PositionLoanCommitted;
  loanMode: "borrow" | "multiply";
}) {
  const account = useAccount();

  const branch = getBranch(loan.branchId);
  const collateral = getCollToken(branch.id);

  const collPriceUsd = usePrice(collateral.symbol);
  const boldPriceUsd = usePrice("BOLD");
  const boldBalance = useBalance(account.address, "BOLD");

  // close from collateral by default for leveraged positions
  const [repayDropdownIndex, setRepayDropdownIndex] = useState(loanMode === "multiply" ? 1 : 0);

  const claimOnly = dn.eq(loan.borrowed, DNUM_0); // happens in case the loan got redeemed
  const repayWithCollateral = !claimOnly && repayDropdownIndex === 1;
  const repayToken = repayWithCollateral ? collateral : BOLD;
  const slippageProtection = dn.mul(loan.borrowed, LEVERAGE_SLIPPAGE_TOLERANCE);

  const collToRepay = useQuoteExactOutput({
    inputToken: collateral.symbol,
    outputToken: "BOLD",
    outputAmount: dn.add(loan.borrowed, slippageProtection),
  });

  // either in BOLD or in collateral
  const amountToRepay = repayWithCollateral
    ? collToRepay.data?.inputAmount
    : loan.borrowed;

  const amountToRepayUsd = amountToRepay && (
    repayWithCollateral
      ? collPriceUsd.data && dn.mul(amountToRepay, collPriceUsd.data)
      : boldPriceUsd.data && dn.mul(amountToRepay, boldPriceUsd.data)
  );

  // when repaying with collateral, subtract the amount used to repay
  const collToReclaim = repayWithCollateral
    ? collToRepay.data?.inputAmount && dn.sub(loan.deposit, collToRepay.data.inputAmount)
    : loan.deposit;

  const collToReclaimUsd = collToReclaim && collPriceUsd.data && dn.mul(
    collToReclaim,
    collPriceUsd.data,
  );

  const isOwner = Boolean(account.address && addressesEqual(account.address, loan.borrower));

  const error = (() => {
    if (!isOwner) {
      return {
        name: "Not the owner",
        message: "The current account is not the owner of the loan.",
      };
    }
    if (repayWithCollateral) {
      if (collToRepay.data?.inputAmount === null) {
        return {
          name: `Insufficient ${collateral.name} liquidity`,
          message: "There's not enough liquidity to repay the loan using collateral.",
        };
      }
    } else {
      if (boldBalance.data && dn.lt(boldBalance.data, loan.borrowed)) {
        return {
          name: "Insufficient JPYDF balance",
          message: `The balance held by the account (${
            fmtnum(boldBalance.data)
          } JPYDF) is insufficient to repay the loan.`,
        };
      }
    }
    return null;
  })();

  const allowSubmit = error === null && (!repayWithCollateral || collToRepay.data);

  return (
    <>
      <VFlex gap={48}>
        {!claimOnly && (
          <Field
            label="You repay with"
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
                    display: "grid",
                    fontSize: 28,
                    lineHeight: 1,
                  })}
                >
                  <Amount
                    value={amountToRepay}
                    title={{ suffix: ` ${repayToken.name}` }}
                    fallback="−"
                  />
                </div>
                <Dropdown
                  buttonDisplay={() => ({
                    icon: <TokenIcon symbol={repayToken.symbol} />,
                    label: (
                      <>
                        {repayToken.name}
                        <span className={css({ color: "contentAlt", fontWeight: 400 })}>
                          {repayWithCollateral ? " loan" : " account"}
                        </span>
                      </>
                    ),
                  })}
                  items={[
                    {
                      icon: <TokenIcon symbol="BOLD" />,
                      label: <div className={css({ whiteSpace: "nowrap" })}>JPYDF (account)</div>,
                      value: fmtnum(boldBalance.data),
                    },
                    {
                      icon: <TokenIcon symbol={collateral.symbol} />,
                      label: <div className={css({ whiteSpace: "nowrap" })}>{collateral.name} (loan)</div>,
                    },
                  ]}
                  menuWidth={300}
                  menuPlacement="end"
                  onSelect={setRepayDropdownIndex}
                  selected={repayDropdownIndex}
                />
              </div>
            }
            footer={{
              start: <Field.FooterInfo label={fmtnum(amountToRepayUsd, { preset: "2z", prefix: "$" }) || "−"} />,
              end: repayWithCollateral && (
                <Field.FooterInfoPriceImpact
                  inputTokenName={collateral.name}
                  outputTokenName="BOLD"
                  priceImpact={collToRepay.data?.priceImpact}
                />
              ),
            }}
          />
        )}
        <Field
          label="You reclaim"
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
                <Amount
                  value={collToReclaim}
                  title={{ suffix: ` ${collateral.name}` }}
                  fallback="−"
                />
              </div>
              <div>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 40,
                    padding: "0 16px 0 8px",
                    fontSize: 24,
                    background: "fieldSurface",
                    borderRadius: 20,
                    userSelect: "none",
                  })}
                >
                  <TokenIcon symbol={collateral.symbol} />
                  <div>{collateral.name}</div>
                </div>
              </div>
            </div>
          }
          footer={{
            start: <Field.FooterInfo label={fmtnum(collToReclaimUsd, { preset: "2z", prefix: "$" }) || "−"} />,

            end: repayWithCollateral && (
              <Field.FooterInfoSlippageRefundClose
                slippageProtection={slippageProtection}
                collateralName={collateral.name}
              />
            ),
          }}
        />
      </VFlex>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 32,
          padding: 16,
          textAlign: "center",
          textWrap: "balance",
          color: "content",
          background: "infoSurface",
          border: "1px solid token(colors.infoSurfaceBorder)",
          borderRadius: 8,
        })}
      >
        {claimOnly
          ? content.closeLoan.claimOnly
          : repayWithCollateral
          ? content.closeLoan.repayWithCollateralMessage(collateral.name)
          : content.closeLoan.repayWithBoldMessage}
      </div>

      {error && (
        <div>
          <ErrorBox title={error?.name}>
            {error?.message}
          </ErrorBox>
        </div>
      )}

      <FlowButton
        disabled={!allowSubmit}
        label={claimOnly
          ? content.closeLoan.buttonReclaimAndClose
          : content.closeLoan.buttonRepayAndClose}
        request={account.address && {
          flowId: "closeLoanPosition",
          backLink: [
            `/loan/close?id=${loan.branchId}:${loan.troveId}`,
            "Back to editing",
          ],
          successLink: ["/", "Go to the dashboard"],
          successMessage: "The loan position has been closed successfully.",
          loan,
          repayWithCollateral: repayWithCollateral
            ? { flashLoanAmount: collToRepay.data?.inputAmount ?? DNUM_0 }
            : undefined,
        }}
      />
    </>
  );
}
