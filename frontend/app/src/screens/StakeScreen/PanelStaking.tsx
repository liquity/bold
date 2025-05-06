import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import content from "@/src/content";
import { DNUM_0, dnumMax } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useGovernanceStats, useGovernanceUser } from "@/src/liquity-governance";
import { useStakePosition } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, InputField, Tabs, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function PanelStaking() {
  const account = useAccount();
  const lqtyPrice = usePrice("LQTY");

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const govStats = useGovernanceStats();
  const govUser = useGovernanceUser(account.address ?? null);

  const stakePosition = useStakePosition(account.address ?? null);

  const parsedValue = parseInputFloat(value);

  const value_ = (focused || !parsedValue || dn.lte(parsedValue, 0))
    ? value
    : fmtnum(parsedValue, "full");

  const depositDifference = dn.mul(
    parsedValue ?? DNUM_0,
    mode === "withdraw" ? -1 : 1,
  );

  const updatedShare = (() => {
    const { totalLQTYStaked } = govStats.data ?? {};
    const { allocatedLQTY } = govUser.data ?? {};

    if (
      allocatedLQTY === undefined
      || totalLQTYStaked === undefined
    ) {
      return DNUM_0;
    }

    const updatedUserLqtyAllocated = allocatedLQTY + depositDifference[0];
    const updatedTotalLqtyStaked = totalLQTYStaked + depositDifference[0];

    // make sure we don't divide by zero or show negative percentages
    return (updatedUserLqtyAllocated <= 0n || updatedTotalLqtyStaked <= 0n)
      ? DNUM_0
      : dn.div(
        [updatedUserLqtyAllocated, 18],
        [updatedTotalLqtyStaked, 18],
      );
  })();

  const updatedDeposit = stakePosition.data?.deposit
    ? dnumMax(
      dn.add(stakePosition.data?.deposit, depositDifference),
      DNUM_0,
    )
    : DNUM_0;

  const lqtyBalance = useBalance(account.address, "LQTY");
  const isDepositFilled = parsedValue && dn.gt(parsedValue, 0);
  const hasDeposit = stakePosition.data?.deposit && dn.gt(
    stakePosition.data?.deposit,
    0,
  );

  const insufficientBalance = mode === "deposit" && isDepositFilled && (
    !lqtyBalance.data || dn.lt(lqtyBalance.data, parsedValue)
  );

  const withdrawOutOfRange = mode === "withdraw" && isDepositFilled && (
    !stakePosition.data || dn.lt(stakePosition.data.deposit, parsedValue)
  );

  const allowSubmit = Boolean(
    account.isConnected
      && isDepositFilled
      && !insufficientBalance,
  );

  const rewardsLusd = stakePosition.data?.rewards.lusd ?? DNUM_0;
  const rewardsEth = stakePosition.data?.rewards.eth ?? DNUM_0;

  return (
    <>
      <Field
        field={
          <InputField
            id="input-staking-change"
            drawer={insufficientBalance
              ? {
                mode: "error",
                message: `Insufficient balance. You have ${fmtnum(lqtyBalance.data ?? 0, 2)} LQTY.`,
              }
              : withdrawOutOfRange
              ? {
                mode: "error",
                message: `You can’t withdraw more than you have staked.`,
              }
              : null}
            contextual={
              <InputTokenBadge
                background={false}
                icon={<TokenIcon symbol="LQTY" />}
                label="LQTY"
              />
            }
            label={{
              start: mode === "withdraw" ? "You withdraw" : "You deposit",
              end: (
                <Tabs
                  compact
                  items={[
                    { label: "Deposit", panelId: "panel-deposit", tabId: "tab-deposit" },
                    { label: "Withdraw", panelId: "panel-withdraw", tabId: "tab-withdraw" },
                  ]}
                  onSelect={(index, { origin, event }) => {
                    setMode(index === 1 ? "withdraw" : "deposit");
                    setValue("");
                    if (origin !== "keyboard") {
                      event.preventDefault();
                      (event.target as HTMLElement).focus();
                    }
                  }}
                  selected={mode === "withdraw" ? 1 : 0}
                />
              ),
            }}
            labelHeight={32}
            onFocus={() => setFocused(true)}
            onChange={setValue}
            onBlur={() => setFocused(false)}
            value={value_}
            placeholder="0.00"
            secondary={{
              start: (
                <Amount
                  prefix="$"
                  value={dn.mul(
                    parsedValue ?? DNUM_0,
                    lqtyPrice.data ?? DNUM_0,
                  )}
                />
              ),
              end: mode === "deposit"
                ? (
                  lqtyBalance.data && dn.gt(lqtyBalance.data, 0) && (
                    <TextButton
                      label={`Max. ${(fmtnum(lqtyBalance.data, 2))} LQTY`}
                      onClick={() => {
                        if (lqtyBalance.data) {
                          setValue(dn.toString(lqtyBalance.data));
                        }
                      }}
                    />
                  )
                )
                : (
                  stakePosition.data?.deposit && dn.gt(stakePosition.data?.deposit, 0) && (
                    <TextButton
                      label={`Max. ${fmtnum(stakePosition.data.deposit, 2)} LQTY`}
                      onClick={() => {
                        if (stakePosition.data) {
                          setValue(dn.toString(stakePosition.data.deposit));
                        }
                      }}
                    />
                  )
                ),
            }}
          />
        }
        footer={{
          start: (
            <Field.FooterInfo
              label="New voting share"
              value={
                <HFlex>
                  <div>
                    <Amount value={updatedShare} percentage suffix="%" />
                  </div>
                  <InfoTooltip>
                    Your voting share is the amount of LQTY have staked and that is available to vote, divided by the
                    total amount of LQTY staked via the governance contract.
                  </InfoTooltip>
                </HFlex>
              }
            />
          ),
        }}
      />
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
          gap: 24,
          width: "100%",
          paddingTop: 16,
        })}
      >
        {hasDeposit && (
          <HFlex justifyContent="space-between">
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
              })}
            >
              <label
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  userSelect: "none",
                })}
              >
                {content.stakeScreen.depositPanel.rewardsLabel}
              </label>
              <InfoTooltip
                {...infoTooltipProps(
                  content.stakeScreen.infoTooltips.alsoClaimRewardsDeposit,
                )}
              />
            </div>
            <div
              className={css({
                display: "flex",
                gap: 24,
              })}
            >
              <div>
                <Amount value={rewardsLusd} />{" "}
                <span
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  LUSD
                </span>
              </div>
              <div>
                <Amount value={rewardsEth} />{" "}
                <span
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  ETH
                </span>
              </div>
            </div>
          </HFlex>
        )}

        <FlowButton
          disabled={!allowSubmit}
          request={account.address && {
            flowId: mode === "deposit" ? "stakeDeposit" : "unstakeDeposit",
            backLink: ["/stake", "Back to stake position"],
            successLink: ["/stake/voting", "Go to Voting"],
            successMessage: "The stake position has been updated successfully.",
            lqtyAmount: dn.abs(depositDifference),
            stakePosition: {
              type: "stake",
              owner: account.address,
              deposit: updatedDeposit,
              totalStaked: dn.add(
                stakePosition.data?.totalStaked ?? DNUM_0,
                depositDifference,
              ),
              rewards: {
                eth: rewardsEth,
                lusd: rewardsLusd,
              },
            },
            prevStakePosition: stakePosition.data
                && dn.gt(stakePosition.data.deposit, 0)
              ? stakePosition.data
              : null,
          }}
        />
      </div>
    </>
  );
}
