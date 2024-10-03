import type { CollIndex, PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useCollateral } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, Checkbox, HFlex, InfoTooltip, InputField, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DepositPanel({
  accountBoldBalance,
  boldQty,
  collIndex,
  position,
}: {
  accountBoldBalance?: Dnum;
  boldQty: Dnum;
  collIndex: null | CollIndex;
  position?: PositionEarn;
}) {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [claimRewards, setClaimRewards] = useState(false);

  const parsedValue = parseInputFloat(value);

  const value_ = (focused || !parsedValue) ? value : `${fmtnum(parsedValue, "full")} BOLD`;

  const depositDifference = parsedValue ?? dn.from(0, 18);

  const updatedDeposit = dn.add(
    position?.deposit ?? dn.from(0, 18),
    depositDifference,
  );

  const updatedBoldQty = dn.add(boldQty, depositDifference);

  const updatedPoolShare = depositDifference && dn.gt(updatedBoldQty, 0)
    ? dn.div(updatedDeposit, updatedBoldQty)
    : DNUM_0;

  const collateral = useCollateral(collIndex);

  const allowSubmit = account.isConnected && parsedValue;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        gap: 48,
      }}
    >
      <Field
        field={
          <InputField
            contextual={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 40,
                  padding: "0 16px",
                  paddingLeft: 8,
                  background: "#FFF",
                  borderRadius: 20,
                  userSelect: "none",
                }}
              >
                <TokenIcon symbol="BOLD" />
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 500,
                  }}
                >
                  BOLD
                </div>
              </div>
            }
            label={content.earnScreen.depositPanel.label}
            onFocus={() => setFocused(true)}
            onChange={setValue}
            onBlur={() => setFocused(false)}
            value={value_}
            placeholder="0.00"
            secondary={{
              start: (
                <HFlex gap={4}>
                  <div>
                    {content.earnScreen.depositPanel.shareLabel}
                  </div>
                  <div>
                    <Amount
                      format={2}
                      percentage
                      value={updatedPoolShare}
                    />
                  </div>
                  <InfoTooltip {...infoTooltipProps(content.earnScreen.infoTooltips.depositPoolShare)} />
                </HFlex>
              ),
              end: accountBoldBalance && (
                <TextButton
                  label={`Max ${fmtnum(accountBoldBalance, 2)} BOLD`}
                  onClick={() => setValue(dn.toString(accountBoldBalance))}
                />
              ),
            }}
          />
        }
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          width: "100%",
        }}
      >
        <HFlex justifyContent="space-between">
          <label
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              userSelect: "none",
            })}
          >
            <Checkbox
              checked={claimRewards}
              onChange={setClaimRewards}
            />
            {content.earnScreen.depositPanel.claimCheckbox}
            <InfoTooltip {...infoTooltipProps(content.earnScreen.infoTooltips.alsoClaimRewardsCheckbox)} />
          </label>
          {position && (
            <div
              className={css({
                display: "flex",
                gap: 24,
              })}
            >
              <div>
                <Amount
                  format={2}
                  value={position.rewards.bold}
                />
                <span
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  BOLD
                </span>
              </div>
              {collateral && (
                <div>
                  <Amount
                    format={2}
                    value={position.rewards.coll}
                  />{" "}
                  <span
                    className={css({
                      color: "contentAlt",
                    })}
                  >
                    {collateral.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </HFlex>
        <ConnectWarningBox />
        <Button
          disabled={!allowSubmit}
          label={claimRewards ? content.earnScreen.depositPanel.actionClaim : content.earnScreen.depositPanel.action}
          mode="primary"
          size="large"
          wide
          onClick={() => {
            if (collateral && account.address && collIndex !== null) {
              txFlow.start({
                flowId: "earnDeposit",
                backLink: [
                  `/earn/${collateral.name.toLowerCase()}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the Dashboard"],
                successMessage: "The earn position has been created successfully.",

                depositor: account.address,
                boldAmount: depositDifference,
                claim: claimRewards,
                collIndex,
              });
              router.push("/transactions");
            }
          }}
        />
      </div>
    </div>
  );
}
