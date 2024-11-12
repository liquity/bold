import type { PositionLoanCommitted } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { ErrorBox } from "@/src/comps/ErrorBox/ErrorBox";
import { Field } from "@/src/comps/Field/Field";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { fmtnum } from "@/src/formatting";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { addressesEqual, Button, Dropdown, TokenIcon, TOKENS_BY_SYMBOL, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function PanelClosePosition({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const contracts = getContracts();
  const collateral = contracts.collaterals[loan.collIndex];
  const collToken = TOKENS_BY_SYMBOL[collateral.symbol];

  const collPriceUsd = usePrice(collToken.symbol);
  const boldPriceUsd = usePrice("BOLD");
  const boldBalance = useBalance(account.address, "BOLD");

  const [repayDropdownIndex, setRepayDropdownIndex] = useState(0);
  const repayToken = TOKENS_BY_SYMBOL[repayDropdownIndex === 0 ? "BOLD" : collToken.symbol];

  // either in BOLD or in collateral
  const amountToRepay = repayToken.symbol === "BOLD"
    ? loan.borrowed
    : collPriceUsd && dn.div(loan.borrowed, collPriceUsd);

  const amountToRepayUsd = amountToRepay && (
    repayToken.symbol === "BOLD"
      ? boldPriceUsd && dn.mul(amountToRepay, boldPriceUsd)
      : collPriceUsd && dn.mul(amountToRepay, collPriceUsd)
  );

  // when repaying with collateral, subtract the amount used to repay
  const collToReclaim = repayToken.symbol === "BOLD"
    ? loan.deposit
    : amountToRepay && dn.sub(loan.deposit, amountToRepay);

  const collToReclaimUsd = collToReclaim && collPriceUsd && dn.mul(
    collToReclaim,
    collPriceUsd,
  );

  const isOwner = Boolean(account.address && addressesEqual(account.address, loan.borrower));

  const error = (() => {
    if (!isOwner) {
      return {
        name: "Not the owner",
        message: "The current account is not the owner of the loan.",
      };
    }
    if (
      isOwner
      && repayToken.symbol === "BOLD"
      && amountToRepay
      && (!boldBalance.data || dn.lt(boldBalance.data, amountToRepay))
    ) {
      return {
        name: "Insufficient BOLD balance",
        message: `The balance held by the account (${
          fmtnum(boldBalance.data)
        } BOLD) is insufficient to repay the loan.`,
      };
    }
    return null;
  })();

  if (!collPriceUsd || !boldPriceUsd || !amountToRepay || !collToReclaim) {
    return null;
  }

  const allowSubmit = error === null;

  return (
    <>
      <VFlex gap={48}>
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
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                {fmtnum(amountToRepay)}
              </div>
              <Dropdown
                buttonDisplay={() => ({
                  icon: <TokenIcon symbol={repayToken.symbol} />,
                  label: (
                    <>
                      {repayToken.name}
                      <span
                        className={css({
                          color: "contentAlt",
                          fontWeight: 400,
                        })}
                      >
                        {repayToken.symbol === "BOLD" ? " account" : " loan"}
                      </span>
                    </>
                  ),
                })}
                items={(["BOLD", collToken.symbol] as const).map((symbol) => ({
                  icon: <TokenIcon symbol={symbol} />,
                  label: (
                    <div
                      className={css({
                        whiteSpace: "nowrap",
                      })}
                    >
                      {TOKENS_BY_SYMBOL[symbol].name} {symbol === "BOLD" ? "(account)" : "(loan collateral)"}
                    </div>
                  ),
                  value: symbol === "BOLD" ? fmtnum(boldBalance.data) : null,
                }))}
                menuWidth={300}
                menuPlacement="end"
                onSelect={setRepayDropdownIndex}
                selected={repayDropdownIndex}
              />
            </div>
          }
          footer={{
            start: (
              <Field.FooterInfo
                label={`$${fmtnum(amountToRepayUsd)}`}
                value={null}
              />
            ),
          }}
        />
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
                <div>{fmtnum(collToReclaim)}</div>
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
                  <TokenIcon symbol={collToken.symbol} />
                  <div>{collToken.name}</div>
                </div>
              </div>
            </div>
          }
          footer={{
            start: (
              <Field.FooterInfo
                label={`$${fmtnum(collToReclaimUsd)}`}
                value={null}
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
        {repayToken.symbol === "BOLD"
          ? content.closeLoan.repayWithBoldMessage
          : content.closeLoan.repayWithCollateralMessage}
      </div>
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

        {error && (
          <div>
            <ErrorBox title={error?.name}>
              {error?.message}
            </ErrorBox>
          </div>
        )}

        <Button
          disabled={!allowSubmit}
          label="Repay & close"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            if (account.address) {
              txFlow.start({
                flowId: "closeLoanPosition",
                backLink: [
                  `/loan/close?id=${loan.collIndex}:${loan.troveId}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The loan position has been closed successfully.",

                loan: { ...loan },
                repayWithCollateral: repayToken.symbol !== "BOLD",
              });
            }
          }}
        />
      </div>
    </>
  );
}
