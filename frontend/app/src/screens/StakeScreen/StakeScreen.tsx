"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Details } from "@/src/comps/Details/Details";
import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ACCOUNT_STAKED_LQTY, ETH_PRICE, STAKED_LQTY_TOTAL } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { formatPercentage } from "@/src/formatting";
import { usePrice } from "@/src/services/Prices";
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

  const lqtyPrice = usePrice("LQTY");

  const tab = TABS.findIndex(({ id }) => id === action);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} LQTY`);
  const withdraw = useInputFieldValue((value) => `${dn.format(value)} LQTY`);

  if (!lqtyPrice) {
    return null;
  }

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
                  <div>{depositShare(ACCOUNT_STAKED_LQTY.deposit, 4)}</div>
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
                    contextual={
                      <InputField.Badge
                        icon={<TokenIcon symbol="LQTY" />}
                        label="LQTY"
                      />
                    }
                    label="You deposit"
                    placeholder="0.00"
                    secondary={{
                      start: deposit.parsed && `$${dn.format(dn.mul(deposit.parsed, lqtyPrice), 2)}`,
                      end: (
                        <TextButton
                          label={`Max. ${dn.format(ACCOUNT_BALANCES.LQTY, 2)} LQTY`}
                          onClick={() => {
                            deposit.setValue(
                              dn.toString(ACCOUNT_BALANCES.LQTY),
                            );
                          }}
                        />
                      ),
                    }}
                    {...deposit.inputFieldProps}
                  />
                }
                footerStart={
                  <Field.FooterInfo
                    label="New voting power"
                    value={
                      <HFlex>
                        <div>
                          {depositShare(deposit.parsed && dn.add(ACCOUNT_STAKED_LQTY.deposit, deposit.parsed), 4)}
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
                    contextual={
                      <InputField.Badge
                        icon={<TokenIcon symbol="LQTY" />}
                        label="LQTY"
                      />
                    }
                    label="You withdraw"
                    placeholder="0.00"
                    secondary={{
                      start: withdraw.parsed && `$${dn.format(dn.mul(withdraw.parsed, lqtyPrice), 2)}`,
                      end: (
                        <TextButton
                          label={`Max. ${dn.format(ACCOUNT_STAKED_LQTY.deposit, 2)} LQTY`}
                          onClick={() => {
                            withdraw.setValue(
                              dn.toString(ACCOUNT_STAKED_LQTY.deposit),
                            );
                          }}
                        />
                      ),
                    }}
                    {...withdraw.inputFieldProps}
                  />
                }
                footerStart={
                  <Field.FooterInfo
                    label="New voting power"
                    value={
                      <HFlex>
                        <div>
                          {depositShare(withdraw.parsed && dn.sub(ACCOUNT_STAKED_LQTY.deposit, withdraw.parsed), 4)}
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
                  background: "surface",
                  border: "1px solid token(colors.border)",
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
                      <InfoTooltip heading="LUSD rewards">
                        −
                      </InfoTooltip>
                    }
                  />
                  <RewardAmount
                    value={ACCOUNT_STAKED_LQTY.rewardEth}
                    symbol="ETH"
                    help={
                      <InfoTooltip heading="ETH rewards">
                        −
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
                    borderTop: "1px solid token(colors.border)",
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

function depositShare(deposit?: Dnum | null, digits?: number) {
  return formatPercentage(deposit && dn.div(deposit, STAKED_LQTY_TOTAL), { digits });
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
