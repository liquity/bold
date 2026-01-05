"use client";

import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Screen } from "@/src/comps/Screen/Screen";
import { Value } from "@/src/comps/Value/Value";
import { REDEMPTION_MAX_ITERATIONS_PER_COLL, REDEMPTION_SLIPPAGE_TOLERANCE } from "@/src/constants";
import content from "@/src/content";
import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getBranches, getCollToken, useRedemptionSimulation } from "@/src/liquity-utils";
import { useCollateralRedemptionPrices, usePrice } from "@/src/services/Prices";
import { zipWith } from "@/src/utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconExternal, InfoTooltip, InputField, TextButton, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";

const TRUNCATED_THRESHOLD = dnum18(100); // wei
const maxIterationsPerCollateral = REDEMPTION_MAX_ITERATIONS_PER_COLL;
const slippageTolerance = dn.from(REDEMPTION_SLIPPAGE_TOLERANCE);

const branches = getBranches();
const collTokens = branches.map((b) => getCollToken(b.branchId));
const collTokenNames = collTokens.map((collToken) => collToken.name.replace(/^ETH$/, "WETH"));

const listOfCollTokenNames = [
  ...(
    collTokenNames.length > 1
      ? [collTokenNames.slice(0, -1).join(", ")]
      : []
  ),
  ...collTokenNames.slice(-1),
].join(" and ");

const zipWithMul = zipWith(dn.mul);

export function RedeemScreen() {
  const account = useAccount();
  const boldBalance = useBalance(account.address, "BOLD");
  const boldPrice = usePrice("BOLD");
  const collPrices = useCollateralRedemptionPrices(branches.map((b) => b.symbol));
  const boldRedeemed = useInputFieldValue(fmtnum);

  const simulation = useRedemptionSimulation({
    boldAmount: boldRedeemed.parsed ?? DNUM_0,
    maxIterationsPerCollateral,
  });

  const boldRedeemedUsd = simulation.data && boldPrice.data
    && dn.mul(simulation.data.truncatedBold, boldPrice.data);

  const collRedeemedUsd = simulation.data && collPrices.data
    && zipWithMul(simulation.data.collRedeemed, collPrices.data);

  const totalCollRedeemedUsd = collRedeemedUsd
    && collRedeemedUsd.reduce((a, b) => dn.add(a, b));

  const profitLoss = totalCollRedeemedUsd && boldRedeemedUsd
    && dn.sub(totalCollRedeemedUsd, boldRedeemedUsd);

  const isLoss = profitLoss
    && dn.lt(profitLoss, DNUM_0);

  const truncatedAmount = boldRedeemed.parsed && simulation.data?.bouncing === false
      && dn.gt(dn.sub(boldRedeemed.parsed, simulation.data.truncatedBold), TRUNCATED_THRESHOLD)
    ? simulation.data.truncatedBold
    : null;

  const amount = truncatedAmount ?? boldRedeemed.parsed;
  const amountNonZero = amount && dn.gt(amount, DNUM_0);
  const balanceSufficient = amount && boldBalance.data && dn.lte(amount, boldBalance.data);
  const allowSubmit = account.isConnected && amountNonZero && balanceSufficient;

  const drawer = boldRedeemed.isFocused || !account.isConnected
    ? null
    : !balanceSufficient
    ? {
      mode: "error" as const,
      message: `Insufficient JPYDF balance. You have ${fmtnum(boldBalance.data)} JPYDF.`,
    }
    : truncatedAmount
    ? {
      mode: "warning" as const,
      message: (
        <HFlex gap={4}>
          Amount capped to avoid excessive costs.
          <InfoTooltip>
            The number of loans you redeem from will be capped at {maxIterationsPerCollateral}{" "}
            per collateral branch. This is to avoid a transaction with unusually large gas usage, which might delay the
            execution of your redemption.
            <br />
            <br />
            You will be able to redeem the rest of your JPYDF in a follow-up transaction.
          </InfoTooltip>
        </HFlex>
      ),
    }
    : null;

  const redemptionFee = simulation.data?.feePct && simulation.data.truncatedBold
    ? dn.mul(simulation.data.feePct, simulation.data.truncatedBold)
    : null;

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            Redeem
            <TokenIcon symbol="BOLD" />
            JPYDF for
            <TokenIcon.Group>
              {collTokens.map(({ symbol }) => <TokenIcon key={symbol} symbol={symbol} />)}
            </TokenIcon.Group>
            ETH
          </HFlex>
        ),
      }}
    >
      <VFlex gap={48}>
        <VFlex gap={24}>
          <Field
            field={
              <InputField
                id="input-redeem-amount"
                contextual={
                  <InputField.Badge
                    icon={<TokenIcon symbol="BOLD" />}
                    label="JPYDF"
                  />
                }
                drawer={drawer}
                label="You redeem"
                placeholder="0.00"
                secondary={{
                  start: fmtnum(boldRedeemedUsd, { prefix: "$", preset: "2z" }) || " ",
                  end: (
                    boldBalance.data && dn.gt(boldBalance.data, 0) && (
                      <TextButton
                        label={`Max ${fmtnum(boldBalance.data)} JPYDF`}
                        onClick={() => {
                          if (boldBalance.data) {
                            boldRedeemed.setValue(dn.toString(boldBalance.data));
                          }
                        }}
                      />
                    )
                  ),
                }}
                {...boldRedeemed.inputFieldProps}
                // Show trucated amount when input field is not focused
                value={!boldRedeemed.isFocused && truncatedAmount
                  ? fmtnum(truncatedAmount)
                  : boldRedeemed.inputFieldProps.value}
              />
            }
          />

          <VFlex>
            <HFlex justifyContent="space-between" alignItems="center">
              <HFlex gap={4} alignItems="center">
                Redemption Fee
                {simulation.data?.feePct && (
                  <div className={css({ color: "contentAlt" })}>
                    (<Amount value={simulation.data.feePct} percentage />)
                  </div>
                )}
                <InfoTooltip
                  content={{
                    heading: "Redemption fee",
                    body: (
                      <>
                        You will be charged a dynamic redemption fee — the more redemptions, the higher the fee. During
                        periods of no redemption activity, the fee slowly decreases towards a minimum of 0.5%. If you
                        see a fee significantly higher than this, it might make sense to try redeeming at a later time,
                        or to break up your redemption into several smaller ones.
                      </>
                    ),
                    footerLink: {
                      label: "Learn more about the fee",
                      href: "https://docs.liquity.org/v2-faq/redemptions-and-delegation#is-there-a-redemption-fee",
                    },
                  }}
                />
              </HFlex>
              <HFlex gap={8}>
                <Value
                  negative={redemptionFee !== null && dn.gt(redemptionFee, DNUM_0)}
                  className={css({ fontSize: 20 })}
                >
                  <Amount
                    format="2z"
                    prefix="-"
                    value={redemptionFee}
                    fallback="−"
                    title={{ prefix: "-", suffix: " JPYDF" }}
                  />
                </Value>
                <TokenIcon symbol="BOLD" size={24} />
              </HFlex>
            </HFlex>
          </VFlex>

          <VFlex gap={24}>
            <HFlex justifyContent="space-between" alignItems="center">
              <HFlex gap={8} alignItems="center">
                You receive
              </HFlex>
              <VFlex alignItems="flex-end" gap={0}>
                <div className={css({ fontSize: 20 })}>
                  <Amount
                    format="2z"
                    prefix="$"
                    value={totalCollRedeemedUsd}
                    fallback="−"
                  />
                </div>
                <div className={css({ color: "contentAlt", fontSize: 14 })}>
                  worth of collateral
                </div>
              </VFlex>
            </HFlex>

            {branches.map((branch) => {
              const collAmount = simulation.data?.collRedeemed[branch.branchId];
              const collUsd = collRedeemedUsd?.[branch.branchId];
              const collToken = getCollToken(branch.branchId);
              const tokenName = collToken.symbol === "ETH" ? "WETH" : collToken.name;

              return (
                <HFlex
                  key={branch.symbol}
                  alignItems="start"
                  justifyContent="space-between"
                  className={css({ paddingLeft: 24 })}
                >
                  <HFlex gap={4} className={css({ color: "contentAlt" })}>
                    {tokenName}
                    {tokenName === "WETH" && (
                      <InfoTooltip heading="Wrapped Ether">
                        You will receive{" "}
                        <abbr title="Wrapped Ether">WETH</abbr>: an ERC-20 tokenized version of ETH that is equivalent
                        in value.
                      </InfoTooltip>
                    )}
                  </HFlex>

                  <VFlex gap={0} alignItems="end">
                    <HFlex gap={6} className={css({ fontSize: 18 })}>
                      <Amount format="4z" value={collAmount} fallback="−" title={{ suffix: ` ${tokenName}` }} />
                      <TokenIcon symbol={branch.symbol} size={20} />
                    </HFlex>

                    <div className={css({ paddingRight: 26, color: "contentAlt", fontSize: 14 })}>
                      <Amount format="2z" prefix="$" value={collUsd} fallback="−" />
                    </div>
                  </VFlex>
                </HFlex>
              );
            })}
          </VFlex>

          <HFlex justifyContent="space-between" alignItems="center">
            <HFlex gap={4}>
              Profit/loss
              <InfoTooltip>
                This is the estimated USD value of all the tokens you will receive minus the value of the JPYDF you are
                paying.
              </InfoTooltip>
            </HFlex>
            <Value negative={isLoss} className={css({ fontSize: 20 })}>
              <Amount
                format="2z"
                prefix={isLoss ? "-$" : "+$"}
                value={profitLoss && dn.abs(profitLoss)}
                fallback="−"
              />
            </Value>
          </HFlex>
        </VFlex>

        <InfoBox title="Important note">
          Your JPYDF will be taken at face value and converted to a mix of{" "}
          {listOfCollTokenNames}, minus the redemption fee. Unless JPYDF is trading significantly below $1, you will get
          a better rate by swapping on an exchange.

          <LinkTextButton
            href="https://docs.liquity.org/v2-faq/redemptions-and-delegation"
            target="_blank"
            rel="noopener noreferrer"
            label={
              <HFlex gap={4}>
                Learn more about redemptions <IconExternal size={16} />
              </HFlex>
            }
          />
        </InfoBox>

        <FlowButton
          disabled={!allowSubmit}
          label={content.borrowScreen.action}
          request={{
            flowId: "redeemCollateral",
            backLink: ["/redeem", "Back"],
            successLink: ["/", "Go to the Dashboard"],
            successMessage: "The redemption was successful.",

            amount: amount ?? DNUM_0,
            maxIterationsPerCollateral,
            feePct: simulation.data?.feePct ?? DNUM_0,
            collRedeemed: simulation.data?.collRedeemed ?? [],
            slippageTolerance,
          }}
        />
      </VFlex>
    </Screen>
  );
}

function InfoBox(props: {
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 16,
        color: "infoSurfaceContent",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
      })}
    >
      {props.title && (
        <header className={css({ display: "flex", flexDirection: "column", fontSize: 16 })}>
          <h1 className={css({ fontWeight: 600 })}>{props.title}</h1>
        </header>
      )}

      {props.children}
    </section>
  );
}
