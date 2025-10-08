"use client";

import type { Dnum, PositionYusnd } from "@/src/types";

import { useBreakpointName } from "@/src/breakpoints";
import { Amount } from "@/src/comps/Amount/Amount";
import { YusndPositionSummary } from "@/src/comps/EarnPositionSummary/YusndPositionSummary";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { YusndInfo } from "@/src/comps/YusndInfo/YusndInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import content from "@/src/content";
import { DNUM_0, dnumMax } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useWait } from "@/src/react-utils";
import { isYusndEnabled, usePreviewDeposit, usePreviewRedeem, useYusndPosition, useYusndStats } from "@/src/yusnd";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconEarn, InfoTooltip, InputField, Tabs, TextButton, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";

export function YusndPoolScreen() {
  if (!isYusndEnabled()) {
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
  const yusndPosition = useYusndPosition(account.address ?? null);
  const yusndStats = useYusndStats();
  const ready = useWait(500);
  const breakpointName = useBreakpointName();

  const loadingState = !ready || yusndPosition.isLoading || yusndStats.isLoading ? "loading" : "success";

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

  const usndBalance = useBalance(account.address, "USND");

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
          finalHeight={breakpointName === "large" ? 140 : 194}
        >
          {loadingState === "success"
            ? (
              <YusndPositionSummary
                yusndPosition={yusndPosition.data ?? null}
                tvl={yusndStats.data?.totalUsnd}
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
                    Fetching yUSND data…
                    <Spinner size={18} />
                  </HFlex>
                </div>
              </>
            )}
        </ScreenCard>
      }
    >
      {loadingTransition((style, item) => (
        item === "success" && (
          <a.div
            style={{
              display: "flex",
              opacity: style.opacity,
            }}
          >
            <PanelUpdate
              usndBalance={usndBalance.data ?? DNUM_0}
              yusndPosition={yusndPosition.data ?? null}
              yusndStats={yusndStats}
            />
          </a.div>
        )
      ))}
    </Screen>
  );
}

type ValueUpdateMode = "deposit" | "redeem";

export function PanelUpdate({
  usndBalance,
  yusndPosition,
  yusndStats,
}: {
  usndBalance: Dnum;
  yusndPosition: PositionYusnd | null;
  yusndStats: ReturnType<typeof useYusndStats>;
}) {
  const account = useAccount();

  const [mode, setMode] = useState<ValueUpdateMode>("deposit");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const parsedValue = parseInputFloat(value);

  const hasAnyBoldDeposited = dn.gt(yusndPosition?.usnd ?? DNUM_0, 0);
  const depositDifference = dn.mul(
    parsedValue ?? DNUM_0,
    mode === "redeem" ? -1 : 1,
  );

  const value_ = (focused || !parsedValue || dn.lte(parsedValue, 0))
    ? value
    : `${fmtnum(parsedValue, "full")}`;

  const updatedDeposit = dnumMax(
    dn.add(yusndPosition?.usnd ?? DNUM_0, depositDifference),
    DNUM_0,
  );

  const totalDepositedBoldUpdated = dn.add(
    yusndStats.data?.totalUsnd ?? DNUM_0,
    depositDifference,
  );

  const updatedPoolShare = dn.gt(totalDepositedBoldUpdated, 0)
    ? dn.div(updatedDeposit, totalDepositedBoldUpdated)
    : DNUM_0;

  const insufficientBalance = mode === "deposit"
    && parsedValue
    && dn.lt(usndBalance, parsedValue);

  const withdrawAboveDeposit = mode === "redeem"
    && parsedValue
    && dn.gt(parsedValue, yusndPosition?.usnd ?? DNUM_0);

  const depositPreview = usePreviewDeposit(
    mode === "deposit" && parsedValue ? parsedValue : null,
  );

  const redeemPreview = usePreviewRedeem(
    mode === "redeem" && parsedValue ? parsedValue : null,
  );

  const allowSubmit = account.isConnected
    && parsedValue
    && dn.gt(parsedValue, 0)
    && !insufficientBalance
    && !withdrawAboveDeposit
    && !depositPreview.isFetching
    && !redeemPreview.isFetching;

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
          overflow: "hidden",
          gap: 24,
        }}
      >
        <Field
          field={
            <InputField
              drawer={insufficientBalance
                ? {
                  mode: "error",
                  message: `Insufficient balance. You have ${fmtnum(usndBalance)} USND.`,
                }
                : withdrawAboveDeposit
                ? {
                  mode: "error",
                  message: hasAnyBoldDeposited
                    ? `You can’t withdraw more than you have deposited.`
                    : `No USND deposited.`,
                }
                : null}
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol={mode === "deposit" ? "USND" : "YUSND"} title={mode === "redeem" ? "Yield-bearing USND optimized by Yearn." : undefined} />}
                  label={mode === "deposit" ? "USND" : "yUSND"}
                />
              }
              id="input-deposit-change"
              label={{
                start: mode === "redeem"
                  ? "Redeem yUSND"
                  : "Deposit USND",
                end: (
                  <Tabs
                    compact
                    items={[
                      { label: "Deposit", panelId: "panel-deposit", tabId: "tab-deposit" },
                      { label: "Redeem", panelId: "panel-withdraw", tabId: "tab-withdraw" },
                    ]}
                    onSelect={(index, { origin, event }) => {
                      setMode(index === 1 ? "redeem" : "deposit");
                      setValue("");
                      if (origin !== "keyboard") {
                        event.preventDefault();
                        (event.target as HTMLElement).focus();
                      }
                    }}
                    selected={mode === "redeem" ? 1 : 0}
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
                end: mode === "deposit"
                  ? (
                    dn.gt(usndBalance, 0) && (
                      <TextButton
                        label={`Max ${fmtnum(usndBalance, 2)} USND`}
                        onClick={() => {
                          setValue(dn.toString(usndBalance));
                        }}
                      />
                    )
                  )
                  : yusndPosition?.yusnd && dn.gt(yusndPosition.yusnd, 0) && (
                    <TextButton
                      label={`Max ${fmtnum(yusndPosition.yusnd, 2)} yUSND`}
                      onClick={() => {
                        setValue(dn.toString(yusndPosition.yusnd));
                      }}
                    />
                  ),
              }}
            />
          }
        />

        <YusndInfo
          conversion={mode === "deposit"
            ? {
              mode: "deposit",
              usndAmount: parsedValue ?? DNUM_0,
              yusndAmount: depositPreview.data?.yusnd ?? null,
            }
            : {
              mode: "redeem",
              usndAmount: redeemPreview.data ?? null,
              yusndAmount: parsedValue ?? DNUM_0,
            }}
          loading={mode === "deposit"
            ? depositPreview.isFetching
            : redeemPreview.isFetching}
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
            if (redeemPreview.isError) {
              throw redeemPreview.error;
            }
            if (depositPreview.isError) {
              throw depositPreview.error;
            }
            if (
              !account.address
              || !parsedValue
              || (mode === "deposit" && (depositPreview.isFetching || !depositPreview.data))
              || (mode === "redeem" && (redeemPreview.isFetching || !redeemPreview.data))
            ) {
              return null;
            }

            const prevYusndPosition = yusndPosition ?? {
              type: "yusnd" as const,
              owner: account.address,
              usnd: DNUM_0,
              yusnd: DNUM_0,
            };

            const [newUsndDeposit, newYusndBalance] = mode === "deposit"
              ? [
                dn.add(prevYusndPosition.usnd, parsedValue),
                dn.add(prevYusndPosition.yusnd, depositPreview.data?.yusnd ?? DNUM_0),
              ]
              : [
                dnumMax(dn.sub(prevYusndPosition.usnd, redeemPreview.data ?? DNUM_0), DNUM_0),
                dn.sub(prevYusndPosition.yusnd, parsedValue),
              ];

            const newYusndPosition = {
              ...prevYusndPosition,
              usnd: newUsndDeposit,
              yusnd: newYusndBalance,
            };

            const depositFee = mode === "deposit"
                && depositPreview.data?.isFeeNegligible === false
              ? depositPreview.data.boldFee
              : DNUM_0;

            if (mode === "redeem") {
              return {
                flowId: "yusndRedeem",
                backLink: ["/earn/yusnd", "Back to editing"],
                successLink: ["/earn/yusnd", "Go to the yUSND Pool"],
                successMessage: "The yUSND has been redeemed successfully.",
                yusndPosition: newYusndPosition,
                prevYusndPosition: prevYusndPosition,
              };
            }

            return {
              flowId: "yusndDeposit",
              backLink: ["/earn/yusnd", "Back to editing"],
              successLink: ["/earn/yusnd", "Go to the yUSND Pool"],
              successMessage: "The deposit has been processed successfully.",
              depositFee,
              yusndPosition: newYusndPosition,
              prevYusndPosition: prevYusndPosition,
            };
          }}
        />
      </div>
    </div>
  );
}
