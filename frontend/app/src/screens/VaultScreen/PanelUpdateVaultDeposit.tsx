import type { BranchId, PositionEarn } from "@/src/types";
import type { Dnum } from "dnum";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import content from "@/src/content";
import { DNUM_0, dnumMax } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getCollToken, isEarnPositionActive } from "@/src/liquity-utils";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { Button, bvUSD, HFlex, InfoTooltip, InputField, Tabs, TextButton, TokenIcon, USDT } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

type ValueUpdateMode = "add" | "remove";

export function PanelUpdateVaultDeposit({
  deposited,
  branchId,
  position,
}: {
  deposited: Dnum;
  branchId: BranchId;
  position?: PositionEarn;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const [mode, setMode] = useState<ValueUpdateMode>("add");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const hasDeposit = dn.gt(position?.deposit ?? DNUM_0, 0);
  const isActive = isEarnPositionActive(position ?? null);

  const parsedValue = parseInputFloat(value);

  const value_ = (focused || !parsedValue || dn.lte(parsedValue, 0)) ? value : `${fmtnum(parsedValue, "full")}`;

  const depositDifference = mode === "remove" ? dn.mul(parsedValue ?? DNUM_0, -1) : (parsedValue ?? DNUM_0);

  const updatedDeposit = dnumMax(
    dn.add(position?.deposit ?? DNUM_0, depositDifference),
    DNUM_0,
  );

  const boldBalance = useBalance(account.address, "bvUSD");

  const updatedBoldQty = dn.add(deposited, depositDifference);

  const updatedPoolShare = depositDifference && dn.gt(updatedBoldQty, 0)
    ? dn.div(updatedDeposit, updatedBoldQty)
    : DNUM_0;

  const collateral = bvUSD

  const insufficientBalance = mode === "add"
    && parsedValue
    && boldBalance.data
    && dn.lt(boldBalance.data, parsedValue);

  const withdrawAboveDeposit = mode === "remove"
    && parsedValue
    && dn.gt(parsedValue, position?.deposit ?? DNUM_0);

  const allowSubmit = account.isConnected
    && parsedValue
    && dn.gt(parsedValue, 0)
    && !insufficientBalance
    && !withdrawAboveDeposit;

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
            drawer={insufficientBalance
              ? {
                mode: "error",
                message: `Insufficient balance. You have ${fmtnum(boldBalance.data ?? 0)} bvUSD.`,
              }
              : withdrawAboveDeposit
                ? {
                  mode: "error",
                  message: hasDeposit
                    ? `You can’t withdraw more than you have deposited.`
                    : `No bvUSD deposited.`,
                }
                : null}
            contextual={
              <InputTokenBadge
                background={false}
                icon={<TokenIcon symbol="bvUSD" />}
                label="bvUSD"
              />
            }
            id="input-deposit-change"
            label={{
              start: mode === "remove"
                ? content.earnScreen.withdrawPanel.label
                : content.earnScreen.depositPanel.label,
              end: (
                <Tabs
                  compact
                  items={[
                    { label: "Deposit", panelId: "panel-deposit", tabId: "tab-deposit" },
                    { label: "Withdraw", panelId: "panel-withdraw", tabId: "tab-withdraw" },
                  ]}
                  onSelect={(index, { origin, event }) => {
                    setMode(index === 1 ? "remove" : "add");
                    setValue("");
                    if (origin !== "keyboard") {
                      event.preventDefault();
                      (event.target as HTMLElement).focus();
                    }
                  }}
                  selected={mode === "remove" ? 1 : 0}
                />
              )
            }}
            labelHeight={32}
            onFocus={() => setFocused(true)}
            onChange={setValue}
            onBlur={() => setFocused(false)}
            value={value_}
            placeholder="0.00"
            secondary={{
              start: (
                <HFlex gap={4}>
                  <div>{content.earnScreen.depositPanel.shareLabel}</div>
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
              end: mode === "add"
                ? boldBalance.data && (
                  <TextButton
                    label={dn.gt(boldBalance.data, 0) ? `Max ${fmtnum(boldBalance.data, 2)} bvUSD` : null}
                    onClick={() => setValue(dn.toString(boldBalance.data))}
                  />
                )
                : position?.deposit && dn.gt(position.deposit, 0) && (
                  <TextButton
                    label={`Max ${fmtnum(position.deposit, 2)} bvUSD`}
                    onClick={() => {
                      setValue(dn.toString(position.deposit));
                    }}
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
        <ConnectWarningBox />
        <Button
          disabled={!allowSubmit}
          label={content.earnScreen.depositPanel.action}
          mode="primary"
          size="medium"
          shape="rectangular"
          wide
          onClick={() => {
            if (!account.address || !collateral || (mode === "remove" && !position)) {
              return;
            }

            const prevEarnPosition = position ?? {
              type: "earn" as const,
              owner: account.address,
              branchId,
              deposit: DNUM_0,
              rewards: { bold: DNUM_0, coll: DNUM_0 },
            };

            txFlow.start({
              flowId: "vaultUpdate",
              backLink: [
                `/vault`,
                "Back to editing",
              ],
              successLink: ["/", "Go to the Dashboard"],
              successMessage: mode === "remove"
                ? "The withdrawal has been processed successfully."
                : "The deposit has been processed successfully.",
              token: mode === "remove" ? "0x6c869d1D11299172586A4fe225b9BF6f5DBA6225" : "0x96c6995a7737959708c2ed9129d07c94f012d2ce",
              mode: mode,
              prevEarnPosition,
              earnPosition: {
                ...prevEarnPosition,
                deposit: updatedDeposit,
              }
            });
          }}
        />
      </div>
    </div>
  );
}
