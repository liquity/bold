"use client";

import { ScreenCard } from "@/src/comps/Screen/ScreenCard";
import { Screen } from "@/src/comps/Screen/Screen";
import { COLLATERALS } from "@liquity2/uikit";
import { useLiquityStats } from "@/src/liquity-utils";
import { match, P } from "ts-pattern";
import { css } from "@/styled-system/css";
import { HFlex, LoadingSurface } from "@liquity2/uikit";
import { TokenCard } from "@/src/screens/HomeScreen/HomeScreen";

const KNOWN_COLLATERAL_SYMBOLS = COLLATERALS.map(({ symbol }) => symbol);

export function StatsScreen() {
  const liquityStats = useLiquityStats();
  const loadingState =
    liquityStats.isLoading || liquityStats.status === "pending"
      ? "loading"
      : liquityStats.status === "error"
      ? "error"
      : "success";

  return (
    <Screen
      heading={{
        title: "BvUSD stats",
        subtitle: "Transparency page",
      }}
    >
      <ScreenCard
        finalHeight={200}
        mode={match(loadingState)
          .returnType<"ready" | "loading" | "error">()
          .with("loading", () => "loading")
          .with("error", () => "error")
          .otherwise(() => "ready")}
      >
        {match(loadingState)
          .with("loading", () => (
            <div
              className={css({
                display: "grid",
                placeItems: "center",
                height: "100%",
              })}
            >
              <div
                className={css({
                  position: "absolute",
                  top: 16,
                  left: 16,
                })}
              ></div>
              <LoadingSurface />
            </div>
          ))
          .with("error", () => (
            <HFlex gap={8}>
              Error fetching data
              {/* <Button
              mode="primary"
              label="Try again"
              size="mini"
              onClick={onRetry}
            /> */}
            </HFlex>
          ))
          .otherwise(() => {
            if (!liquityStats) {
              <HFlex gap={8}>Invalid Data</HFlex>;
            }
            console.log(liquityStats);
            return (
              <div>
              <div
                className={css({
                  display: "grid",
                  gap: 24,
                })}
                style={{
                  gridTemplateColumns: `repeat(3, 1fr)`,
                  gridAutoRows: 180,
                }}
              >
                <TokenCard
                  token="Total Supply"
                  subValues={[
                    {
                      label: "Value",
                      value: liquityStats.data.totalBoldSupply,
                    },
                  ]}
                />
                <TokenCard
                  token="Total Debt Pending"
                  subValues={[
                    {
                      label: "Value",
                      value: liquityStats.data.totalDebtPending,
                    },
                  ]}
                />
                <TokenCard
                  token="Total Collateral"
                  subValues={[
                    {
                      label: "Value",
                      value: liquityStats.data.totalCollValue,
                    },
                  ]}
                />
                <TokenCard
                  token="Total SP Deposits"
                  subValues={[
                    {
                      label: "Value",
                      value: liquityStats.data.totalSpDeposits,
                    },
                  ]}
                />
                <TokenCard
                  token="Total Value Locked"
                  subValues={[
                    {
                      label: "Value",
                      value: liquityStats.data.totalValueLocked,
                    },
                  ]}
                />
                <TokenCard
                  token="BTC BRANCH"
                  subValues={[
                    {
                      label: "Collateral Active",
                      value: liquityStats.data.branch["WETH"].collActive,
                    },
                    {
                      label: "Debt",
                      value: liquityStats.data.branch["WETH"].spDeposits,
                    },
                    {
                      label: "TVL",
                      value: liquityStats.data.branch["WETH"].valueLocked,
                    },
                  ]}
                />
                {/* Total Bold Supply: {liquityStats.data.totalBoldSupply}
                Total Debt Pending: {liquityStats.data.totalDebtPending}
                Total Collateral Value: {liquityStats.data.totalCollValue}
                Total SP Deposits: {liquityStats.data.totalSpDeposits}
                Total Value Locked: {liquityStats.data.totalValueLocked}
                Max SP APY: {liquityStats.data.maxSpApy}
              </HFlex>
              <HFlex gap={8}>
                ETH BRANCH
                Collateral: {liquityStats.data.branch["WETH"].collActive}
                Default: {liquityStats.data.branch["WETH"].collDefault}
                Collateral Price: {liquityStats.data.branch["WETH"].collPrice}
                Stability Pool: {liquityStats.data.branch["WETH"].spDeposits}
                Interest accrual 1 Year: {liquityStats.data.branch["WETH"].interestAccrual1y}
                Pending Interest: {liquityStats.data.branch["WETH"].interestPending}
                SP Apy: {liquityStats.data.branch["WETH"].spApy}
                SP Apy Average: {liquityStats.data.branch["WETH"].apyAvg} */}
              </div>
              <div
                className={css({
                  display: "grid",
                  gap: 24,
                })}
                style={{
                  gridTemplateColumns: `repeat(1, 1fr)`,
                  gridAutoRows: 180,
                }}
              >
                <TokenCard
                  token="BTC BRANCH"
                  subValues={[
                    {
                      label: "Collateral Active",
                      value: liquityStats.data.branch["WETH"].collActive,
                    },
                    {
                      label: "Debt",
                      value: liquityStats.data.branch["WETH"].spDeposits,
                    },
                    {
                      label: "TVL",
                      value: liquityStats.data.branch["WETH"].valueLocked,
                    },
                  ]}
                />
                {/* Total Bold Supply: {liquityStats.data.totalBoldSupply}
                Total Debt Pending: {liquityStats.data.totalDebtPending}
                Total Collateral Value: {liquityStats.data.totalCollValue}
                Total SP Deposits: {liquityStats.data.totalSpDeposits}
                Total Value Locked: {liquityStats.data.totalValueLocked}
                Max SP APY: {liquityStats.data.maxSpApy}
              </HFlex>
              <HFlex gap={8}>
                ETH BRANCH
                Collateral: {liquityStats.data.branch["WETH"].collActive}
                Default: {liquityStats.data.branch["WETH"].collDefault}
                Collateral Price: {liquityStats.data.branch["WETH"].collPrice}
                Stability Pool: {liquityStats.data.branch["WETH"].spDeposits}
                Interest accrual 1 Year: {liquityStats.data.branch["WETH"].interestAccrual1y}
                Pending Interest: {liquityStats.data.branch["WETH"].interestPending}
                SP Apy: {liquityStats.data.branch["WETH"].spApy}
                SP Apy Average: {liquityStats.data.branch["WETH"].apyAvg} */}
              </div>
              </div>

            );
          })}
      </ScreenCard>
    </Screen>
  );
}
