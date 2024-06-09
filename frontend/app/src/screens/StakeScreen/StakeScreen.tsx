"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Details } from "@/src/comps/Details/Details";
import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ACCOUNT_STAKED_LQTY, ETH_PRICE, STAKED_LQTY_TOTAL } from "@/src/demo-data";
import { useInputFieldValue } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import { Button, HFlex, InfoTooltip, InputField, Tabs, TextButton, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";

const TABS = [
  { label: content.stakeScreen.tabs.deposit, id: "deposit" },
  { label: content.stakeScreen.tabs.withdraw, id: "withdraw" },
  { label: content.stakeScreen.tabs.claim, id: "claim" },
];

export function StakeScreen() {
  const router = useRouter();
  const { action = "deposit" } = useParams();

  const tab = TABS.findIndex(({ id }) => id === action);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} LQTY`);
  const withdraw = useInputFieldValue((value) => `${dn.format(value)} LQTY`);

  return (
    <Screen
      title={
        <HFlex>
          <span>Stake</span>
          <TokenIcon size={24} symbol="LQTY" />
          <span>LQTY & get</span>
          <TokenIcon.Group>
            <TokenIcon symbol="LUSD" />
            <TokenIcon symbol="ETH" />
          </TokenIcon.Group>
          <span>LUSD + ETH</span>
        </HFlex>
      }
    >
      <VFlex gap={32}>
        <Details
          items={[
            {
              label: content.stakeScreen.accountDetails.myDeposit,
              value: `${dn.format(ACCOUNT_STAKED_LQTY.deposit)} LQTY`,
            },
            {
              label: content.stakeScreen.accountDetails.votingPower,
              value: (
                <HFlex justifyContent="flex-start" gap={4}>
                  <div>{votingPower(ACCOUNT_STAKED_LQTY.deposit, 4)}</div>
                  <InfoTooltip>
                    {content.stakeScreen.accountDetails.votingPowerHelp}
                  </InfoTooltip>
                </HFlex>
              ),
            },
            {
              label: content.stakeScreen.accountDetails.unclaimed,
              value: (
                <HFlex
                  gap={8}
                  justifyContent="flex-start"
                  className={css({
                    fontSize: 14,
                    color: "positive",
                    whiteSpace: "nowrap",
                  })}
                >
                  {dn.format(ACCOUNT_STAKED_LQTY.rewardLusd)} LUSD
                  <div
                    className={css({
                      display: "flex",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: "dimmed",
                    })}
                  />
                  {dn.format(ACCOUNT_STAKED_LQTY.rewardEth)} ETH
                </HFlex>
              ),
            },
          ]}
        />
        <VFlex gap={24}>
          <Tabs
            items={TABS.map(({ label, id }) => ({
              label,
              panelId: `p-${id}`,
              tabId: `t-${id}`,
            }))}
            selected={tab}
            onSelect={(index) => {
              router.push(`/stake/${TABS[index].id}`);
            }}
          />
          {action === "deposit" && (
            <>
              <Field
                field={
                  <InputField
                    action={
                      <StaticAction
                        icon={<TokenIcon symbol="LQTY" />}
                        label="LQTY"
                      />
                    }
                    label="You deposit"
                    placeholder="0.00"
                    secondaryStart="$0.00"
                    secondaryEnd={
                      <TextButton
                        label={`Max. ${dn.format(ACCOUNT_BALANCES.LQTY, 2)} LQTY`}
                        onClick={() => {
                          deposit.setValue(
                            dn.toString(ACCOUNT_BALANCES.LQTY),
                          );
                        }}
                      />
                    }
                    {...deposit.inputFieldProps}
                  />
                }
                footerStart={
                  <Field.FooterInfo
                    label="Voting power"
                    value={
                      <HFlex>
                        <div>{votingPower(deposit.parsed)}</div>
                        <InfoTooltip>
                          Voting power is the percentage of the total staked LQTY that you own.
                        </InfoTooltip>
                      </HFlex>
                    }
                  />
                }
                footerEnd={null}
              />
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
                  LQTY will be staked into Liquity V1 and you will receive any rewards attributable there.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  paddingTop: 16,
                }}
              >
                <Button
                  disabled={!(deposit.parsed && dn.gt(deposit.parsed, 0))}
                  label="Stake"
                  mode="primary"
                  size="large"
                  wide
                />
              </div>
            </>
          )}
          {action === "withdraw" && (
            <>
              <Field
                field={
                  <InputField
                    action={
                      <StaticAction
                        icon={<TokenIcon symbol="LQTY" />}
                        label="LQTY"
                      />
                    }
                    label="You withdraw"
                    placeholder="0.00"
                    secondaryStart="$0.00"
                    secondaryEnd={
                      <TextButton
                        label={`Max. ${dn.format(ACCOUNT_STAKED_LQTY.deposit, 2)} LQTY`}
                        onClick={() => {
                          withdraw.setValue(
                            dn.toString(ACCOUNT_STAKED_LQTY.deposit),
                          );
                        }}
                      />
                    }
                    {...withdraw.inputFieldProps}
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
                  disabled={!(deposit.parsed && dn.gt(deposit.parsed, 0))}
                  label="Unstake"
                  mode="primary"
                  size="large"
                  wide
                />
              </div>
            </>
          )}
          {action === "claim" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: "100%",
                gap: 58,
              }}
            >
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "0 16px",
                  background: "background",
                  border: "1px solid token(colors.fieldBorder)",
                  borderRadius: 8,
                })}
              >
                <div
                  className={css({
                    paddingTop: 8,
                    fontSize: 16,
                    fontWeight: 500,
                    color: "contentAlt",
                  })}
                >
                  You claim
                </div>

                <div
                  className={css({
                    display: "flex",
                    gap: 32,
                  })}
                >
                  <RewardAmount
                    value={ACCOUNT_STAKED_LQTY.rewardLusd}
                    symbol="LUSD"
                    help={
                      <InfoTooltip>
                        LUSD lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      </InfoTooltip>
                    }
                  />
                  <RewardAmount
                    value={ACCOUNT_STAKED_LQTY.rewardEth}
                    symbol="ETH"
                    help={
                      <InfoTooltip>
                        ETH lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      </InfoTooltip>
                    }
                  />
                </div>

                <div
                  className={css({
                    display: "flex",
                    gap: 16,
                    marginTop: -1,
                    padding: "20px 0",
                    color: "contentAlt",
                    borderTop: "1px solid token(colors.fieldBorder)",
                  })}
                >
                  {content.earnScreen.rewardsPanel.details(
                    dn.format(
                      dn.add(
                        ACCOUNT_STAKED_LQTY.rewardLusd,
                        dn.mul(ACCOUNT_STAKED_LQTY.rewardEth, ETH_PRICE),
                      ),
                      2,
                    ),
                    "9.78",
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                <Button
                  label={content.earnScreen.rewardsPanel.action}
                  mode="primary"
                  size="large"
                  wide
                />
              </div>
            </div>
          )}
        </VFlex>
      </VFlex>
    </Screen>
  );
}

function StaticAction({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        paddingLeft: icon ? 8 : 16,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      }}
    >
      {icon}
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function votingPower(deposit?: Dnum | null, digits?: number) {
  return deposit && dn.gt(deposit, 0)
    ? (dn.gt(deposit, STAKED_LQTY_TOTAL)
      ? "100%"
      : `${
        dn.format(
          dn.mul(dn.div(deposit, STAKED_LQTY_TOTAL), 100),
          { digits: digits },
        )
      }%`)
    : "−";
}

function RewardAmount({
  symbol,
  value,
  help,
}: {
  symbol: string;
  value: Dnum;
  help?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "flex-end",
      })}
    >
      <div
        className={css({
          fontSize: 24,
        })}
      >
        {dn.format(value)}
      </div>
      <div
        className={css({
          paddingLeft: 8,
          paddingBottom: 3,
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {symbol}
      </div>
      {help && (
        <div
          className={css({
            paddingLeft: 4,
          })}
        >
          {help}
        </div>
      )}
    </div>
  );
}
