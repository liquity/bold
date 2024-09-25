import type { PositionLoan } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { fmtnum } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { Button, Dropdown, TokenIcon, TOKENS_BY_SYMBOL, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PanelClosePosition({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collPrice = usePrice(loan.collateral);
  const boldPriceUsd = usePrice("BOLD");
  const [tokenIndex, setTokenIndex] = useState(0);

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];

  if (!collPrice || !boldPriceUsd) {
    return null;
  }

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const repayWith = tokenIndex === 0 ? "BOLD" : collateral.symbol;

  const amountToRepay = repayWith === "BOLD"
    ? (loanDetails.debt ?? dn.from(0))
    : (dn.div(loanDetails.debt ?? dn.from(0), collPrice));

  const collToReclaim = repayWith === "BOLD"
    ? loan.deposit
    : dn.sub(loan.deposit, amountToRepay);

  const allowSubmit = account.isConnected && tokenIndex === 0;

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
                buttonDisplay={() => ({
                  label: (
                    <>
                      {TOKENS_BY_SYMBOL[(["BOLD", collateral.symbol] as const)[tokenIndex]].name}
                      <span
                        className={css({
                          color: "contentAlt",
                          fontWeight: 400,
                        })}
                      >
                        {TOKENS_BY_SYMBOL[(["BOLD", collateral.symbol] as const)[tokenIndex]].symbol === "BOLD"
                          ? " account"
                          : " loan"}
                      </span>
                    </>
                  ),
                  icon: <TokenIcon symbol={(["BOLD", collateral.symbol] as const)[tokenIndex]} />,
                })}
                items={(["BOLD", collateral.symbol] as const).map((symbol) => ({
                  icon: <TokenIcon symbol={symbol} />,
                  label: (
                    <>
                      {collateral.name} {symbol === "BOLD" ? "(account balance)" : "(loan collateral)"}
                    </>
                  ),
                }))}
                menuWidth={300}
                onSelect={setTokenIndex}
                selected={tokenIndex}
              />
            </div>
          }
          footer={[[
            <Field.FooterInfo
              label={`$${fmtnum(dn.mul(loan.borrowed, boldPriceUsd), 2)}`}
              value={null}
            />,
            null,
          ]]}
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
                  <TokenIcon symbol={collateral.symbol} />
                  <div>{collateral.name}</div>
                </div>
              </div>
            </div>
          }
          label="You reclaim"
          footer={[[
            <Field.FooterInfo
              label={`$${fmtnum(dn.mul(loan.deposit, collPrice), 2)}`}
              value={null}
            />,
            null,
          ]]}
        />
      </VFlex>
      <div
        className={css({
          padding: 20,
          textAlign: "center",
          background: "yellow:200",
          borderRadius: 8,
        })}
      >
        You are repaying your debt and closing the position. {repayWith === "BOLD"
          ? `The deposit will be returned to your wallet.`
          : `To close yor position, a part of your collateral will be sold to pay back the debt. The rest of your collateral will be returned to your wallet.`}
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

                collIndex: loan.collIndex,
                prefixedTroveId: getPrefixedTroveId(loan.collIndex, loan.troveId),
              });
              router.push("/transactions");
            }
          }}
        />
      </div>
    </>
  );
}
