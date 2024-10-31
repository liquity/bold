import type { PositionLoan } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { ErrorBox } from "@/src/comps/ErrorBox/ErrorBox";
import { Field } from "@/src/comps/Field/Field";
import { getContracts } from "@/src/contracts";
import { fmtnum } from "@/src/formatting";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { Button, Dropdown, TokenIcon, TOKENS_BY_SYMBOL, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useState } from "react";

export function PanelClosePosition({ loan }: { loan: PositionLoan }) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const contracts = getContracts();
  const { symbol } = contracts.collaterals[loan.collIndex];
  const collToken = TOKENS_BY_SYMBOL[symbol];

  const collPrice = usePrice(symbol);
  const boldPriceUsd = usePrice("BOLD");

  const [repayTokenIndex, setRepayTokenIndex] = useState(0);
  const repayWith = repayTokenIndex === 0 ? "BOLD" : symbol;

  const boldBalance = useBalance(account.address, "BOLD");

  const amountToRepay = collPrice && (
    repayWith === "BOLD"
      ? loan.borrowed
      : dn.div(loan.borrowed, collPrice)
  );

  const collToReclaim = amountToRepay && (
    repayWith === "BOLD"
      ? loan.deposit
      : dn.sub(loan.deposit, amountToRepay)
  );

  let error: null | { name: string; message: string } = null;
  if (account.address?.toLowerCase() !== loan.borrower.toLowerCase()) {
    error = {
      name: "INVALID_OWNER",
      message: "The current account is not the owner of the loan.",
    };
  } else if (repayTokenIndex === 0 && amountToRepay && (!boldBalance.data || dn.lt(boldBalance.data, amountToRepay))) {
    error = {
      name: "INSUFFICIENT_BALANCE",
      message: "Insufficient BOLD balance to repay the loan.",
    };
  }

  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (error === null) {
      setShowError(false);
    }
  }, [error]);

  if (!collPrice || !boldPriceUsd || !amountToRepay || !collToReclaim) {
    return null;
  }

  const allowSubmit = error === null;

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
                <div>{fmtnum(amountToRepay)}</div>
              </div>
              <Dropdown
                menuPlacement="end"
                buttonDisplay={() => ({
                  label: (
                    <>
                      {TOKENS_BY_SYMBOL[(["BOLD", symbol] as const)[repayTokenIndex]].name}
                      <span
                        className={css({
                          color: "contentAlt",
                          fontWeight: 400,
                        })}
                      >
                        {TOKENS_BY_SYMBOL[(["BOLD", symbol] as const)[repayTokenIndex]].symbol === "BOLD"
                          ? " account"
                          : " loan"}
                      </span>
                    </>
                  ),
                  icon: <TokenIcon symbol={(["BOLD", symbol] as const)[repayTokenIndex]} />,
                })}
                items={(["BOLD", symbol] as const).map((symbol) => ({
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
                onSelect={setRepayTokenIndex}
                selected={repayTokenIndex}
              />
            </div>
          }
          footer={{
            start: (
              <Field.FooterInfo
                label={`$${fmtnum(dn.mul(loan.borrowed, boldPriceUsd), 2)}`}
                value={null}
              />
            ),
          }}
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
                  <TokenIcon symbol={symbol} />
                  <div>{collToken.name}</div>
                </div>
              </div>
            </div>
          }
          label="You reclaim"
          footer={{
            start: (
              <Field.FooterInfo
                label={`$${
                  fmtnum(
                    dn.mul(
                      collToReclaim,
                      collPrice,
                    ),
                    2,
                  )
                }`}
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
          color: "content",
          background: "fieldSurface",
          border: "1px solid token(colors.border)",
          borderRadius: 8,
        })}
      >
        {repayWith === "BOLD"
          ? `You are repaying your debt and closing the position. The deposit will be returned to your wallet.`
          : `To close your position, a part of your collateral will be sold to pay back the debt. The rest of your collateral will be returned to your wallet.`}
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

        {error && showError && (
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
            if (error) {
              setShowError(true);
              return;
            }
            if (account.address) {
              txFlow.start({
                flowId: "closeLoanPosition",
                backLink: [
                  `/loan/close?id=${loan.collIndex}:${loan.troveId}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The loan position has been closed successfully.",

                collIndex: loan.collIndex,
                prefixedTroveId: getPrefixedTroveId(loan.collIndex, loan.troveId),
                repayWithCollateral: repayWith === symbol,
              });
            }
          }}
        />
      </div>
    </>
  );
}
