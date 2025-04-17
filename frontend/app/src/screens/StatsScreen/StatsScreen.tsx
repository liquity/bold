"use client";

import {
  StatsScreenCard,
  StatsTitle,
} from "@/src/comps/Screen/StatsScreenCard";
import { COLLATERALS } from "@liquity2/uikit";
import { useLiquityStats } from "@/src/liquity-utils";
import { match } from "ts-pattern";
import { css } from "@/styled-system/css";
import { HFlex, LoadingSurface } from "@liquity2/uikit";
import { TokenCard } from "@/src/screens/HomeScreen/HomeScreen";
import { fmtnum } from "@/src/formatting";
import SupplyChart from "./SupplyChart";
import CollateralRatioChart from "./CollateralRatioChart";

// TODO fix branch symbol after production deployment
export function StatsScreen() {
  const liquityStats = useLiquityStats();
  const loadingState =
    liquityStats.isLoading || liquityStats.status === "pending"
      ? "loading"
      : liquityStats.status === "error"
      ? "error"
      : "success";

  return (
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
              <>
                <StatsTitle
                  title="Transparency Page"
                  subtitle="bvUSD statistics"
                />
                <div
                  className={css({
                    display: "grid",
                    gap: 24,
                    width: "100%",
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
                        label: "",
                        value: `${fmtnum(
                          Number(liquityStats.data.totalBoldSupply),
                          "2z"
                        )} bvUSD`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="Total Collateral Value"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(
                          Number(liquityStats.data.totalCollValue),
                          "2z"
                        )} $`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="Total Value Locked"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(
                          Number(liquityStats.data.totalValueLocked),
                          "2z"
                        )} $`,
                      },
                    ]}
                  />
                </div>
                <div
                  className={css({
                    marginTop: "5%",
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
                    token="BTC Branch"
                    subValues={[
                      {
                        label: "Collateral",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["WETH"].collActive),
                          "2z"
                        )} BTC`,
                      },
                      {
                        label: "Collateral Value",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["WETH"].collValue),
                          "2z"
                        )} $`,
                      },
                      {
                        label: "TVL",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["WETH"].valueLocked),
                          "2z"
                        )} $`,
                      },
                    ]}
                  />
                  <TokenCard
                    token="ETH Branch"
                    subValues={[
                      {
                        label: "Collateral",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["ETH"].collActive),
                          "2z"
                        )} ETH`,
                      },
                      {
                        label: "Collateral Value",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["ETH"].collValue),
                          "2z"
                        )} $`,
                      },
                      {
                        label: "TVL",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["ETH"].valueLocked),
                          "2z"
                        )} $`,
                      },
                    ]}
                  />
                </div>
                <div
                  className={css({
                    marginTop: "5%",
                  })}
                >
                  <StatsTitle title="Historical stats" subtitle="" />
                  <SupplyChart data={liquityStats.data.historicalSupply} />
                  <CollateralRatioChart
                    data={liquityStats.data.historicalGlobalCR}
                    title="Global Collateral Ratio"
                  />
                  <CollateralRatioChart
                    data={liquityStats.data.branch["WETH"].historicalCR}
                    title="ETH Branch Collateral Ratio"
                  />
                  <CollateralRatioChart
                    data={liquityStats.data.branch["ETH"].historicalCR}
                    title="BTC Branch Collateral Ratio"
                  />
                </div>
              </>
            );
          })}
      </StatsScreenCard>
    </div>
  );
}
