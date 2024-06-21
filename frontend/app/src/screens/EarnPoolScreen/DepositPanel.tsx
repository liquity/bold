import type { PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import { Field } from "@/src/comps/Field/Field";
import content from "@/src/content";
import { useDemoState } from "@/src/demo-state";
import { parseInputFloat } from "@/src/form-utils";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, Checkbox, HFlex, InfoTooltip, InputField, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function DepositPanel({
  accountBoldBalance,
  boldQty,
  position,
}: {
  accountBoldBalance?: Dnum;
  boldQty: Dnum;
  position?: PositionEarn;
}) {
  const { account, setDemoState } = useDemoState();

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [claimRewards, setClaimRewards] = useState(false);

  const parsedValue = parseInputFloat(value);

  const value_ = (focused || !parsedValue) ? value : `${dn.format(parsedValue)} BOLD`;

  const depositDifference = parsedValue ?? dn.from(0, 18);

  const updatedDeposit = dn.add(
    position?.deposit ?? dn.from(0, 18),
    depositDifference,
  );

  const updatedPoolShare = depositDifference
    ? dn.div(updatedDeposit, dn.add(boldQty, depositDifference))
    : null;

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
            action={
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
            secondaryStart={
              <HFlex gap={4}>
                <div>
                  {content.earnScreen.depositPanel.shareLabel}
                </div>
                <div>
                  {updatedPoolShare
                    ? dn.format(dn.mul(updatedPoolShare, 100), 2)
                    : "0"}%
                </div>
                <InfoTooltip {...infoTooltipProps(content.earnScreen.infoTooltips.depositPoolShare)} />
              </HFlex>
            }
            secondaryEnd={accountBoldBalance && (
              <TextButton
                label={`Max ${dn.format(accountBoldBalance)} BOLD`}
                onClick={() => setValue(dn.toString(accountBoldBalance))}
              />
            )}
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
                {dn.format(position.rewards.bold, 2)}{" "}
                <span
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  BOLD
                </span>
              </div>
              <div>
                {dn.format(position.rewards.eth, 2)}{" "}
                <span
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  ETH
                </span>
              </div>
            </div>
          )}
        </HFlex>
        {!account.isConnected && (
          <div
            className={css({
              paddingTop: 16,
            })}
          >
            <div
              className={css({
                padding: "20px 24px",
                textAlign: "center",
                background: "secondary",
                borderRadius: 8,
              })}
            >
              Please{" "}
              <TextButton
                label="connect"
                onClick={() => {
                  setDemoState({
                    account: { isConnected: true },
                  });
                }}
              />{" "}
              your wallet to continue.
            </div>
          </div>
        )}
        <Button
          disabled={!allowSubmit}
          label={claimRewards ? content.earnScreen.depositPanel.actionClaim : content.earnScreen.depositPanel.action}
          mode="primary"
          size="large"
          wide
        />
      </div>
    </div>
  );
}
