"use client";

import type { TokenSymbol } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { Screen } from "@/src/comps/Screen/Screen";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import content from "@/src/content";
import { getProtocolContract } from "@/src/contracts";
import { useDemoMode } from "@/src/demo-mode";
import { ACCOUNT_STAKED_LQTY } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { dnumMax } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useStakePosition } from "@/src/liquity-utils";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  AnchorTextButton,
  Button,
  HFlex,
  InfoTooltip,
  InputField,
  Tabs,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { encodeFunctionData } from "viem";
import { useEstimateGas, useGasPrice } from "wagmi";
import { PanelVoting } from "./PanelVoting";

const TABS = [
  { label: content.stakeScreen.tabs.deposit, id: "deposit" },
  { label: content.stakeScreen.tabs.rewards, id: "rewards" },
  // { label: content.stakeScreen.tabs.voting, id: "voting" },
];

export function StakeScreen() {
  const router = useRouter();
  const { action = "deposit" } = useParams();

  const account = useAccount();

  const stakePosition = useStakePosition(account.address ?? null);

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.stakeScreen.headline(
              <TokenIcon size={24} symbol="LQTY" />,
              <TokenIcon.Group>
                <TokenIcon symbol="LUSD" />
                <TokenIcon symbol="ETH" />
              </TokenIcon.Group>,
            )}
          </HFlex>
        ),
        subtitle: (
          <>
            {content.stakeScreen.subheading}{" "}
            <AnchorTextButton
              label={content.stakeScreen.learnMore[1]}
              href={content.stakeScreen.learnMore[0]}
              external
            />
          </>
        ),
      }}
      gap={48}
    >
      <StakePositionSummary
        stakePosition={stakePosition.data ?? null}
      />
      <VFlex gap={24}>
        <Tabs
          items={TABS.map(({ label, id }) => ({
            label,
            panelId: `p-${id}`,
            tabId: `t-${id}`,
          }))}
          selected={TABS.findIndex(({ id }) => id === action)}
          onSelect={(index) => {
            router.push(`/stake/${TABS[index].id}`);
          }}
        />

        {action === "deposit" && <PanelUpdateStake />}
        {action === "rewards" && <PanelClaimRewards />}
        {action === "voting" && <PanelVoting />}
      </VFlex>
    </Screen>
  );
}

function PanelUpdateStake() {
  const account = useAccount();
  const txFlow = useTransactionFlow();
  const lqtyPrice = usePrice("LQTY");

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const stakePosition = useStakePosition(account.address ?? null);

  const parsedValue = parseInputFloat(value);

  const value_ = (focused || !parsedValue || dn.lte(parsedValue, 0))
    ? value
    : `${dn.format(parsedValue)}`;

  const depositDifference = dn.mul(
    parsedValue ?? dn.from(0, 18),
    mode === "withdraw" ? -1 : 1,
  );

  const updatedDeposit = stakePosition.data?.deposit
    ? dnumMax(
      dn.add(stakePosition.data?.deposit, depositDifference),
      dn.from(0, 18),
    )
    : dn.from(0, 18);

  const hasDeposit = stakePosition.data?.deposit && dn.gt(stakePosition.data?.deposit, 0);

  const updatedShare = stakePosition.data?.totalStaked && dn.gt(stakePosition.data?.totalStaked, 0)
    ? dn.div(updatedDeposit, dn.add(stakePosition.data.totalStaked, depositDifference))
    : dn.from(0, 18);

  const lqtyBalance = useBalance(account.address, "LQTY");

  const allowSubmit = Boolean(account.isConnected && parsedValue && dn.gt(parsedValue, 0));

  const rewardsLusd = dn.from(0, 18);
  const rewardsEth = dn.from(0, 18);

  return (
    <>
      <Field
        field={
          <InputField
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
              start: parsedValue && lqtyPrice ? `$${dn.format(dn.mul(parsedValue, lqtyPrice), 2)}` : null,
              end: mode === "deposit"
                ? (
                  <TextButton
                    label={`Max. ${(fmtnum(lqtyBalance.data ?? 0))} LQTY`}
                    onClick={() => {
                      setValue(dn.toString(lqtyBalance.data ?? dn.from(0, 18)));
                    }}
                  />
                )
                : (
                  stakePosition.data?.deposit && (
                    <TextButton
                      label={`Max. ${fmtnum(stakePosition.data.deposit, 2)} LQTY`}
                      onClick={() => {
                        setValue(dn.toString(stakePosition.data.deposit));
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
              label="New voting power"
              value={
                <HFlex>
                  <div>
                    <Amount value={updatedShare} percentage suffix="%" />
                  </div>
                  <InfoTooltip>
                    Voting power is the percentage of the total staked LQTY that you own.
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
                {...infoTooltipProps(content.stakeScreen.infoTooltips.alsoClaimRewardsDeposit)}
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
        <Button
          disabled={!allowSubmit}
          label="Next: Summary"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            if (account.address) {
              txFlow.start({
                flowId: mode === "deposit" ? "stakeDeposit" : "unstakeDeposit",
                backLink: [`/stake`, "Back to stake position"],
                successLink: ["/", "Go to the Dashboard"],
                successMessage: "The stake position has been updated successfully.",

                lqtyAmount: dn.abs(depositDifference),
                stakePosition: {
                  type: "stake",
                  owner: account.address,
                  deposit: updatedDeposit,
                  share: updatedShare,
                  totalStaked: dn.add(
                    stakePosition.data?.totalStaked ?? dn.from(0, 18),
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
              });
            }
          }}
        />
      </div>
    </>
  );
}

function PanelClaimRewards() {
  const account = useAccount();
  const txFlow = useTransactionFlow();
  const demoMode = useDemoMode();

  const ethPrice = usePrice("ETH");

  const stakePosition = useStakePosition(account.address ?? null);
  const LqtyStaking = getProtocolContract("LqtyStaking");

  const gasEstimate = useEstimateGas({
    account: account.address,
    data: encodeFunctionData({
      abi: LqtyStaking.abi,
      functionName: "unstake",
      args: [0n],
    }),
    to: LqtyStaking.address,
  });

  const gasPrice = useGasPrice();

  if (!ethPrice) {
    return null;
  }

  const txGasPriceEth = gasEstimate.data && gasPrice.data
    ? dnum18(gasEstimate.data * gasPrice.data)
    : null;

  const txGasPriceUsd = txGasPriceEth && dn.mul(txGasPriceEth, ethPrice);

  const rewardsLusd = (
    demoMode.enabled
      ? ACCOUNT_STAKED_LQTY.rewardLusd
      : stakePosition.data?.rewards.lusd
  ) ?? dn.from(0, 18);

  const rewardsEth = (
    demoMode.enabled
      ? ACCOUNT_STAKED_LQTY.rewardEth
      : stakePosition.data?.rewards.eth
  ) ?? dn.from(0, 18);

  const totalRewardsUsd = dn.add(
    rewardsLusd,
    dn.mul(rewardsEth, ethPrice),
  );

  // const allowSubmit = account.isConnected && dn.gt(totalRewardsUsd, 0);
  const allowSubmit = account.isConnected;

  return (
    <VFlex gap={48}>
      <VFlex gap={0}>
        <Rewards
          amount={rewardsLusd}
          label="Issuance gain"
          symbol="LUSD"
        />
        <Rewards
          amount={rewardsEth}
          label="Redemption gain"
          symbol="ETH"
        />

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "24px 0",
            color: "contentAlt",
          })}
        >
          <HFlex justifyContent="space-between" gap={24}>
            <div>Total in USD</div>
            <Amount
              format="2z"
              prefix="$"
              value={totalRewardsUsd}
            />
          </HFlex>
          <HFlex justifyContent="space-between" gap={24}>
            <div>Expected Gas Fee</div>
            <Amount
              format="2z"
              prefix="~$"
              value={txGasPriceUsd ?? 0}
            />
          </HFlex>
        </div>
      </VFlex>

      <ConnectWarningBox />

      <Button
        disabled={!allowSubmit}
        label="Next: Summary"
        mode="primary"
        size="large"
        wide
        onClick={() => {
          if (account.address && stakePosition.data) {
            txFlow.start({
              flowId: "stakeClaimRewards",
              backLink: [
                `/stake`,
                "Back to stake position",
              ],
              successLink: ["/", "Go to the Dashboard"],
              successMessage: "The rewards have been claimed successfully.",

              stakePosition: {
                ...stakePosition.data,
                rewards: {
                  eth: dn.from(0, 18),
                  lusd: dn.from(0, 18),
                },
              },
              prevStakePosition: stakePosition.data,
            });
          }
        }}
      />
    </VFlex>
  );
}

function Rewards({
  amount,
  label,
  symbol,
}: {
  amount: Dnum;
  label: ReactNode;
  symbol: TokenSymbol;
}) {
  return (
    <div
      className={css({
        display: "grid",
        gap: 24,
        gridTemplateColumns: "1.2fr 1fr",
        alignItems: "start",
        padding: "24px 0",
        borderBottom: "1px solid token(colors.separator)",
      })}
    >
      <div
        className={css({
          paddingTop: 4,
        })}
      >
        {label}
      </div>
      <div
        className={css({
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
          fontSize: 28,
        })}
      >
        <Amount value={amount} />
        <TokenIcon symbol={symbol} size={24} />
      </div>
    </div>
  );
}
