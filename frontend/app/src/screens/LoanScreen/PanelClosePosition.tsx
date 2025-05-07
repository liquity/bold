import type { PositionLoanCommitted } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { ErrorBox } from "@/src/comps/ErrorBox/ErrorBox";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import content from "@/src/content";
import { fmtnum } from "@/src/formatting";
import { getBranch, getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { addressesEqual, TokenIcon, TOKENS_BY_SYMBOL, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";

export function PanelClosePosition({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();

  const branch = getBranch(loan.branchId);
  const collateral = getCollToken(branch.id);

  const collPriceUsd = usePrice(collateral.symbol);
  const boldPriceUsd = usePrice("BOLD");
  const boldBalance = useBalance(account.address, "BOLD");

  // const [repayDropdownIndex, setRepayDropdownIndex] = useState(0);
  const repayDropdownIndex = 0;

  const repayToken = TOKENS_BY_SYMBOL[repayDropdownIndex === 0 ? "BOLD" : collateral.symbol];

  // either in BOLD or in collateral
  const amountToRepay = repayToken.symbol === "BOLD"
    ? loan.borrowed
    : collPriceUsd.data && dn.div(loan.borrowed, collPriceUsd.data);

  const amountToRepayUsd = amountToRepay && (
    repayToken.symbol === "BOLD"
      ? boldPriceUsd.data && dn.mul(amountToRepay, boldPriceUsd.data)
      : collPriceUsd.data && dn.mul(amountToRepay, collPriceUsd.data)
  );

  // when repaying with collateral, subtract the amount used to repay
  const collToReclaim = repayToken.symbol === "BOLD"
    ? loan.deposit
    : amountToRepay && dn.sub(loan.deposit, amountToRepay);

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

  if (!collPriceUsd.data || !boldPriceUsd.data || !amountToRepay || !collToReclaim) {
    return null;
  }

  // happens in case the loan got redeemed
  const claimOnly = dn.eq(amountToRepay, 0);

  const allowSubmit = error === null;

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
                    title={{ suffix: " BOLD" }}
                  />
                </div>
                {
                  /*<Dropdown
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
                  items={(["BOLD", collateral.symbol] as const).map((symbol) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: (
                      <div
                        className={css({
                          whiteSpace: "nowrap",
                        })}
                      >
                        {TOKENS_BY_SYMBOL[symbol].name} {symbol === "BOLD" ? "(account)" : "(collateral)"}
                      </div>
                    ),
                    disabled: symbol !== "BOLD",
                    disabledReason: symbol !== "BOLD" ? "Coming soon" : undefined,
                    value: symbol === "BOLD" ? fmtnum(boldBalance.data) : null,
                  }))}
                  menuWidth={300}
                  menuPlacement="end"
                  onSelect={setRepayDropdownIndex}
                  selected={repayDropdownIndex}
                />*/
                }
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
                  <TokenIcon
                    symbol="BOLD"
                    size={24}
                  />
                  <div>BOLD</div>
                </div>
              </div>
            }
            footer={{
              start: (
                <Field.FooterInfo
                  label={fmtnum(amountToRepayUsd, { preset: "2z", prefix: "$" })}
                  value={null}
                />
              ),
            }}
          />
        )}
        <Field
          label="You reclaim collateral"
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
          footer={{
            start: (
              <Field.FooterInfo
                label={fmtnum(collToReclaimUsd, { preset: "2z", prefix: "$" })}
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
        {claimOnly
          ? content.closeLoan.claimOnly
          : repayToken.symbol === "BOLD"
          ? content.closeLoan.repayWithBoldMessage
          : content.closeLoan.repayWithCollateralMessage}
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
          repayWithCollateral: claimOnly ? false : repayToken.symbol !== "BOLD",
        }}
      />
    </>
  );
}
