"use client";

import { StatsScreenCard } from "@/src/comps/Screen/StatsScreenCard";
import { Screen } from "@/src/comps/Screen/Screen";
import { COLLATERALS } from "@liquity2/uikit";
import { useLiquityStats } from "@/src/liquity-utils";
import { match } from "ts-pattern";
import { css } from "@/styled-system/css";
import { HFlex, LoadingSurface } from "@liquity2/uikit";
import { TokenCard } from "@/src/screens/HomeScreen/HomeScreen";
import { fmtnum } from "@/src/formatting";

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
      <div
        className={css({
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          gap: 64,
          width: "100%",
        })}
      >
        <StatsScreenCard
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
              return (
                <div
                  className={css({
                    display: "grid",
                    gap: 24,
                    width: "100%",
                  })}
                  style={{
                    gridTemplateColumns: `repeat(2, 1fr)`,
                    gridAutoRows: 180,
                  }}
                >
                  <TokenCard
                    token="Total Supply"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(Number(liquityStats.data.totalBoldSupply), "2z")} bvUSD`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="Total Collateral Value"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(Number(liquityStats.data.totalCollValue), "2z")} $`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="Total SP Deposits"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(Number(liquityStats.data.totalSpDeposits), "2z")} bvUSD`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="Total Value Locked"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(Number(liquityStats.data.totalValueLocked), "2z")} $`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="BTC Branch"
                    subValues={[
                      {
                        label: "Collateral",
                        value: `${fmtnum(Number(liquityStats.data.branch["WETH"].collActive), "2z")} BTC`,
                      },
                      {
                        label: "Value",
                        value: `${fmtnum(Number(liquityStats.data.branch["WETH"].collValue), "2z")} $`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="ETH Branch"
                    subValues={[
                      {
                        label: "Collateral",
                        value: `${fmtnum(Number(liquityStats.data.branch["ETH"].collValue), "2z")} ETH`,
                      },
                      {
                        label: "Value",
                        value: `${fmtnum(Number(liquityStats.data.branch["ETH"].collValue), "2z")} $`,
                      },
                    ]}
                  />
                </div>
              );
            })}
        </StatsScreenCard>
      </div>
    </Screen>
  );
}