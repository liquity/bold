import type { PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import content from "@/src/content";
import { parseInputFloat } from "@/src/form-utils";
import { useAccount } from "@/src/services/Ethereum";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Checkbox,
  HFlex,
  InfoTooltip,
  InputField,
  TextButton,
  TokenIcon,
  TOKENS_BY_SYMBOL,
} from "@liquity2/uikit";
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
  const account = useAccount();

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
                  label={`Max ${dn.format(accountBoldBalance)} BOLD`}
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
                  {TOKENS_BY_SYMBOL[position.collateral].name}
                </span>
              </div>
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
        />
      </div>
    </div>
  );
}
