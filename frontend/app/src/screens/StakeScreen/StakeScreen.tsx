"use client";

import type { Address, TokenSymbol } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { Screen } from "@/src/comps/Screen/Screen";
import { StakePositionSummary } from "@/src/comps/StakePositionSummary/StakePositionSummary";
import content from "@/src/content";
import { useProtocolContract } from "@/src/contracts";
import { useDemoMode } from "@/src/demo-mode";
import { ACCOUNT_STAKED_LQTY, STAKED_LQTY_TOTAL } from "@/src/demo-mode";
import { dnum18, dnumMax } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
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
import { useReadContracts } from "wagmi";

const TABS = [
  { label: content.stakeScreen.tabs.deposit, id: "deposit" },
  { label: content.stakeScreen.tabs.rewards, id: "rewards" },
  // { label: content.stakeScreen.tabs.voting, id: "voting" },
];

export function StakeScreen() {
  const router = useRouter();
  const { action = "deposit" } = useParams();

  const account = useAccount();
  const lqtyPrice = usePrice("LQTY");

  return !lqtyPrice ? null : (
    <Screen
      title={
        <HFlex>
          {content.stakeScreen.headline(
            <TokenIcon size={24} symbol="LQTY" />,
            <TokenIcon.Group>
              <TokenIcon symbol="LUSD" />
              <TokenIcon symbol="ETH" />
            </TokenIcon.Group>,
          )}
        </HFlex>
      }
      subtitle={
        <>
          {content.stakeScreen.subheading}{" "}
          <AnchorTextButton
            label={content.stakeScreen.learnMore[1]}
            href={content.stakeScreen.learnMore[0]}
            external
          />
        </>
      }
      gap={48}
    >
      <StakePositionSummary address={account.address} />
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

        {action === "deposit" && <PanelUpdateStake lqtyPrice={lqtyPrice} />}
        {action === "withdraw" && null}
        {action === "rewards" && <PanelClaimRewards />}
      </VFlex>
    </Screen>
  );
}

function PanelUpdateStake({ lqtyPrice }: { lqtyPrice: Dnum }) {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const stakePosition = useStakePosition(account.address);

  const parsedValue = parseInputFloat(value);

  const value_ = (focused || !parsedValue || dn.lte(parsedValue, 0))
    ? value
    : `${dn.format(parsedValue)}`;

  const depositDifference = mode === "withdraw"
    ? dn.mul(parsedValue ?? dn.from(0, 18), -1)
    : (parsedValue ?? dn.from(0, 18));

  const updatedDeposit = dnumMax(
    dn.add(stakePosition.stake, depositDifference),
    dn.from(0, 18),
  );

  const updatedShare = dn.gt(stakePosition.totalStaked, 0)
    ? dn.div(updatedDeposit, dn.add(stakePosition.totalStaked, depositDifference))
    : dn.from(0, 18);

  const lqtyBalance = useBalance(account.address, "LQTY");

  const allowSubmit = Boolean(account.isConnected && parsedValue && dn.gt(parsedValue, 0));

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
              start: parsedValue && `$${dn.format(dn.mul(parsedValue, lqtyPrice), 2)}`,
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
                  <TextButton
                    label={`Max. ${fmtnum(stakePosition.stake, 2)} LQTY`}
                    onClick={() => {
                      setValue(dn.toString(stakePosition.stake));
                    }}
                  />
                ),
            }}
          />
        }
        footerStart={
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
        }
      />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          paddingTop: 16,
        }}
      >
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
              });
            }
            router.push("/transactions");
          }}
        />
      </div>
    </>
  );
}

function PanelClaimRewards() {
  const router = useRouter();
  const account = useAccount();
  // const txFlow = useTransactionFlow();
  const demoMode = useDemoMode();

  const ethPrice = usePrice("ETH");

  if (!ethPrice) {
    return null;
  }

  const rewardsLusd = demoMode.enabled ? ACCOUNT_STAKED_LQTY.rewardLusd : dn.from(0, 18);
  const rewardsEth = demoMode.enabled ? ACCOUNT_STAKED_LQTY.rewardEth : dn.from(0, 18);

  const totalRewards = dn.add(
    rewardsLusd,
    dn.mul(rewardsEth, ethPrice),
  );

  const gasFeeUsd = dn.from(0.0015, 18); // Estimated gas fee

  const allowSubmit = account.isConnected && dn.gt(totalRewards, 0);

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
              value={totalRewards}
            />
          </HFlex>
          <HFlex justifyContent="space-between" gap={24}>
            <div>Expected Gas Fee</div>
            <Amount
              format="2z"
              prefix="~$"
              value={gasFeeUsd}
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
          if (account.address) {
            // txFlow.start({
            //   flowId: "stakeClaimRewards",
            //   backLink: [
            //     `/stake`,
            //     "Back to stake position",
            //   ],
            //   successLink: ["/", "Go to the Dashboard"],
            //   successMessage: "The rewards have been claimed successfully.",
            //   staker: account.address,
            // });
            router.push("/transactions");
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

function useStakePosition(address?: Address) {
  const demoMode = useDemoMode();

  const LqtyStaking = useProtocolContract("LqtyStaking");

  let {
    data: {
      stake,
      totalStaked,
    } = {
      stake: dn.from(0),
      totalStaked: dn.from(0),
    },
  } = useReadContracts({
    contracts: [
      {
        abi: LqtyStaking.abi,
        address: LqtyStaking.address,
        functionName: "stakes",
        args: [address ?? "0x"],
      },
      {
        abi: LqtyStaking.abi,
        address: LqtyStaking.address,
        functionName: "totalLQTYStaked",
      },
    ],
    query: {
      enabled: !demoMode.enabled,
      refetchInterval: 10_000,
      select: ([stake, totalStaked]) => ({
        stake: dnum18(stake),
        totalStaked: dnum18(totalStaked),
      }),
    },
    allowFailure: false,
  });

  if (demoMode.enabled) {
    stake = ACCOUNT_STAKED_LQTY.deposit;
    totalStaked = STAKED_LQTY_TOTAL;
  }

  const share = dn.gt(totalStaked, 0)
    ? dn.div(stake, totalStaked)
    : dn.from(0);

  return {
    share,
    stake,
    totalStaked,
  };
}
