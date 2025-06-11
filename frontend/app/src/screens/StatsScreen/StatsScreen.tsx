"use client";

import {
  StatsScreenCard,
  StatsTitle,
} from "@/src/comps/Screen/StatsScreenCard";
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
                    gridTemplateColumns: `repeat(4, 1fr)`,
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
                    link={{ label: "", href: "" }}
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
                    link={{ label: "", href: "" }}
                  />
                  <TokenCard
                    token="Collateralization Ratio"
                    subValues={[
                      {
                        label: "",
                        value: `${fmtnum(
                          (Number(liquityStats.data.totalCollValue) /
                            Number(liquityStats.data.totalBoldSupply)) *
                            100,
                          "2z"
                        )} %`,
                      },
                    ]}
                    link={{ label: "", href: "" }}
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
                    link={{ label: "", href: "" }}
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
                          Number(liquityStats.data.branch["bvBTC"].collActive),
                          "2z"
                        )} BTC`,
                      },
                      {
                        label: "Debt",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["bvBTC"].totalDebt),
                          "2z"
                        )} bvUSD`,
                      },
                      {
                        label: "Collateral Ratio",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["bvBTC"].totalDebt) > 0
                            ? (Number(
                                liquityStats.data.branch["bvBTC"].collValue
                              ) /
                                Number(
                                  liquityStats.data.branch["bvBTC"].totalDebt
                                )) *
                                100
                            : 0,
                          "2z"
                        )} %`,
                      },
                    ]}
                    link={{ label: "", href: "" }}
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
                        label: "Debt",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["ETH"].totalDebt),
                          "2z"
                        )} bvUSD`,
                      },
                      {
                        label: "Collateral Ratio",
                        value: `${fmtnum(
                          Number(liquityStats.data.branch["ETH"].totalDebt) > 0
                            ? (Number(
                                liquityStats.data.branch["ETH"].collValue
                              ) /
                                Number(
                                  liquityStats.data.branch["ETH"].totalDebt
                                )) *
                                100
                            : 0,
                          "2z"
                        )} %`,
                      },
                    ]}
                    link={{ label: "", href: "" }}
                  />
                </div>
                <hr
                  style={{
                    border: "none",
                    height: "1px",
                    backgroundColor: "#ccc",
                    margin: "5%",
                  }}
                />
                <div>
                  <StatsTitle title="Historical stats" subtitle="" />
                  <SupplyChart data={liquityStats.data.historicalSupply} />
                  <CollateralRatioChart
                    data={liquityStats.data.historicalGlobalCR}
                    title="Global Collateral Ratio"
                  />
                  <CollateralRatioChart
                    data={liquityStats.data.branch["bvBTC"].historicalCR}
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
