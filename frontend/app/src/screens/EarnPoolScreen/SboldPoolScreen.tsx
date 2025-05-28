"use client";

import type { Dnum, PositionSbold } from "@/src/types";

import { useBreakpointName } from "@/src/breakpoints";
import { Amount } from "@/src/comps/Amount/Amount";
import { SboldPositionSummary } from "@/src/comps/EarnPositionSummary/SboldPositionSummary";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { SboldInfo } from "@/src/comps/SboldInfo/SboldInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import content from "@/src/content";
import { DNUM_0, dnumMax } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useWait } from "@/src/react-utils";
import { isSboldEnabled, usePreviewDeposit, usePreviewWithdrawal, useSboldPosition, useSboldStats } from "@/src/sbold";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, InfoTooltip, InputField, Tabs, TextButton, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";

export const WITHDRAW_ALL_THRESHOLD = dn.from(0.001, 18); // less than 0.001 BOLD left = withdrawing all (redeem)

function withdrawAllThresholdReached(boldAfterWithdrawal: Dnum) {
  return dn.lt(boldAfterWithdrawal, WITHDRAW_ALL_THRESHOLD);
}

export function SboldPoolScreen() {
  if (!isSboldEnabled()) {
    notFound();
  }

  // scroll to top
  useEffect(() => {
    window.scroll({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }, []);

  const account = useAccount();
  const sboldPosition = useSboldPosition(account.address ?? null);
  const sboldStats = useSboldStats();
  const ready = useWait(500);
  const breakpointName = useBreakpointName();

  const loadingState = !ready || sboldPosition.isLoading || sboldStats.isLoading ? "loading" : "success";

  const loadingTransition = useTransition(loadingState, {
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: {
      mass: 1,
      tension: 2000,
      friction: 120,
    },
  });

  const boldBalance = useBalance(account.address, "BOLD");

  return (
    <Screen
      ready={loadingState === "success"}
      back={{
        href: "/earn",
        label: content.earnScreen.backButton,
      }}
      heading={
        <ScreenCard
          mode={match(loadingState)
            .returnType<"ready" | "loading">()
            .with("success", () => "ready")
            .with("loading", () => "loading")
            .exhaustive()}
          finalHeight={breakpointName === "large" ? 140 : 248}
        >
          {loadingState === "success"
            ? (
              <SboldPositionSummary
                sboldPosition={sboldPosition.data ?? null}
                tvl={sboldStats.data?.totalBold}
              />
            )
            : (
              <>
                <div
                  className={css({
                    position: "absolute",
                    top: 16,
                    left: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textTransform: "uppercase",
                    userSelect: "none",
                    fontSize: 12,
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                    })}
                  >
                    <IconEarn size={16} />
                  </div>
                  <HFlex gap={8}>
                    Fetching sBOLD data…
                    <Spinner size={18} />
                  </HFlex>
                </div>
              </>
            )}
        </ScreenCard>
      }
      className={css({
        position: "relative",
      })}
    >
      {loadingTransition((style, item) => (
        item === "success" && (
          <a.div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            })}
            style={{
              opacity: style.opacity,
            }}
          >
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 24,
                width: "100%",
              })}
            >
              <PanelUpdate
                boldBalance={boldBalance.data ?? DNUM_0}
                sboldPosition={sboldPosition.data ?? null}
                sboldStats={sboldStats}
              />
            </div>
          </a.div>
        )
      ))}
    </Screen>
  );
}

type ValueUpdateMode = "add" | "remove";

export function PanelUpdate({
  boldBalance,
  sboldPosition,
  sboldStats,
}: {
  boldBalance: Dnum;
  sboldPosition: PositionSbold | null;
  sboldStats: ReturnType<typeof useSboldStats>;
}) {
  const account = useAccount();

  const [mode, setMode] = useState<ValueUpdateMode>("add");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const parsedValue = parseInputFloat(value);

  const hasAnyBoldDeposited = dn.gt(sboldPosition?.bold ?? DNUM_0, 0);
  const depositDifference = dn.mul(
    parsedValue ?? DNUM_0,
    mode === "remove" ? -1 : 1,
  );

  const value_ = (focused || !parsedValue || dn.lte(parsedValue, 0))
    ? value
    : `${fmtnum(parsedValue, "full")}`;

  const updatedDeposit = dnumMax(
    dn.add(sboldPosition?.bold ?? DNUM_0, depositDifference),
    DNUM_0,
  );

  const totalDepositedBoldUpdated = dn.add(
    sboldStats.data?.totalBold ?? DNUM_0,
    depositDifference,
  );

  const updatedPoolShare = dn.gt(totalDepositedBoldUpdated, 0)
    ? dn.div(updatedDeposit, totalDepositedBoldUpdated)
    : DNUM_0;

  const insufficientBalance = mode === "add"
    && parsedValue
    && dn.lt(boldBalance, parsedValue);

  const withdrawAboveDeposit = mode === "remove"
    && parsedValue
    && dn.gt(parsedValue, sboldPosition?.bold ?? DNUM_0);

  const depositPreview = usePreviewDeposit(
    mode === "add" && parsedValue ? parsedValue : null,
  );

  const withdrawalPreview = usePreviewWithdrawal(
    mode === "remove" && parsedValue ? parsedValue : null,
  );

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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          gap: 24,
        }}
      >
        <Field
          field={
            <InputField
              drawer={insufficientBalance
                ? {
                  mode: "error",
                  message: `Insufficient balance. You have ${fmtnum(boldBalance)} BOLD.`,
                }
                : withdrawAboveDeposit
                ? {
                  mode: "error",
                  message: hasAnyBoldDeposited
                    ? `You can’t withdraw more than you have deposited.`
                    : `No BOLD deposited.`,
                }
                : null}
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
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
                  ? (
                    dn.gt(boldBalance, 0) && (
                      <TextButton
                        label={`Max ${fmtnum(boldBalance, 2)} BOLD`}
                        onClick={() => {
                          setValue(dn.toString(boldBalance));
                        }}
                      />
                    )
                  )
                  : sboldPosition?.bold && dn.gt(sboldPosition?.bold, 0) && (
                    <TextButton
                      label={`Max ${fmtnum(sboldPosition?.bold, 2)} BOLD`}
                      onClick={() => {
                        setValue(dn.toString(sboldPosition?.bold));
                      }}
                    />
                  ),
              }}
            />
          }
        />
        <SboldInfo
          conversion={mode === "add" && parsedValue
            ? {
              boldAmount: parsedValue ?? DNUM_0,
              sboldAmount: depositPreview.data?.sbold ?? null,
            }
            : null}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          width: "100%",
        }}
      >
        <FlowButton
          disabled={!allowSubmit}
          request={() => {
            console.log(
              mode,
              depositPreview.status,
              depositPreview.error,
              depositPreview.data,
              withdrawalPreview.status,
              withdrawalPreview.error,
              withdrawalPreview.data,
            );
            if (withdrawalPreview.isError) {
              throw withdrawalPreview.error;
            }
            if (depositPreview.isError) {
              throw depositPreview.error;
            }
            if (
              !account.address
              || (
                mode === "add" && (
                  depositPreview.isFetching || !depositPreview.data
                )
              )
              || (
                mode === "remove" && (
                  withdrawalPreview.isFetching || !withdrawalPreview.data
                )
              )
            ) {
              return null;
            }

            const prevSboldPosition = sboldPosition ?? {
              type: "sbold" as const,
              owner: account.address,
              bold: DNUM_0,
              sbold: DNUM_0,
            };

            const newSboldBalance = mode === "add"
              ? dn.add(
                prevSboldPosition.sbold,
                depositPreview.data?.sbold ?? DNUM_0,
              )
              : dn.sub(
                prevSboldPosition.sbold,
                withdrawalPreview.data?.sbold ?? DNUM_0,
              );

            const newBoldDeposit = mode === "add"
              ? dn.add(
                prevSboldPosition.bold,
                depositPreview.data?.boldMinusFee ?? DNUM_0,
              )
              : dn.sub(
                prevSboldPosition.bold,
                parsedValue ?? DNUM_0,
              );

            const withdrawAll = mode === "remove"
              && withdrawAllThresholdReached(newBoldDeposit);

            const newSboldPosition = {
              ...prevSboldPosition,
              bold: withdrawAll ? DNUM_0 : newBoldDeposit,
              sbold: withdrawAll ? DNUM_0 : newSboldBalance,
            };

            const depositFee = mode === "add"
              ? depositPreview.data?.boldFee ?? DNUM_0
              : DNUM_0;

            console.log("WITHDRAW ALL", withdrawAll);

            return {
              flowId: "sboldUpdate",
              backLink: ["/earn/sbold", "Back to editing"],
              successLink: ["/earn/sbold", "Go to the sBOLD Pool"],
              successMessage: mode === "remove"
                ? "The withdrawal has been processed successfully."
                : "The deposit has been processed successfully.",
              depositFee,
              sboldPosition: newSboldPosition,
              prevSboldPosition,
              withdrawAll,
            };
          }}
        />
      </div>
    </div>
  );
}
