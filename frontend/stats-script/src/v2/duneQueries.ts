import {
  BOLD_SUPPLY_DAILY_QUERY,
  COLLATERAL_RATIO_QUERY,
  DUNE_SPV2_AVERAGE_APY_URL_MAINNET,
} from "../constants";

import { duneFetch, type DuneResponse, isDuneResponse } from "../dune";
import { LiquityV2BranchContracts } from "./contracts";

const emptySupplyData = () =>
  Promise.resolve([
    {
      day: "",
      holders: 0,
      supply: 0,
    },
  ]);

const isDuneSpAverageApyResponse = (
  data: unknown
): data is DuneResponse<{
  apr: number;
  collateral_type: string;
}> =>
  isDuneResponse(data) &&
  data.result.rows.length > 0 &&
  data.result.rows.every(
    (row: unknown) =>
      typeof row === "object" &&
      row !== null &&
      "collateral_type" in row &&
      typeof row.collateral_type === "string" &&
      "apr" in row &&
      typeof row.apr === "number"
  );

const isDuneHistoricalSupplyResponse = (
  data: unknown
): data is DuneResponse<{
  day: string;
  num_holders: number;
  token_balance: number;
}> =>
  isDuneResponse(data) &&
  data.result.rows.length > 0 &&
  data.result.rows.every(
    (row: unknown) =>
      typeof row === "object" &&
      row !== null &&
      "day" in row &&
      typeof row.day === "string" &&
      "num_holders" in row &&
      typeof row.num_holders === "number" &&
      "token_balance" in row &&
      typeof row.token_balance === "number"
  );

const isDuneHistoricalCRResponse = (
  data: unknown
): data is DuneResponse<{
  hour: string;
  col_ratio_perc: number;
  avg_col_ratio_perc: number;
  collateral_type: string;
}> =>
  isDuneResponse(data) &&
  data.result.rows.length > 0 &&
  data.result.rows.every(
    (row: unknown) =>
      typeof row === "object" &&
      row !== null &&
      "hour" in row &&
      typeof row.hour === "string" &&
      "col_ratio_perc" in row &&
      typeof row.col_ratio_perc === "number" &&
      "avg_col_ratio_perc" in row &&
      typeof row.avg_col_ratio_perc === "number" &&
      "collateral_type" in row &&
      typeof row.collateral_type === "string"
  );

export const fetchSpAverageApysFromDune = async ({
  branches,
  apiKey,
  network,
}: {
  branches: LiquityV2BranchContracts[];
  apiKey: string;
  network: "bnb" | "mainnet" | "katana";
}) => {
  // const url = network === "sepolia"
  //   ? DUNE_SPV2_AVERAGE_APY_URL_SEPOLIA
  //   : DUNE_SPV2_AVERAGE_APY_URL_MAINNET;

  const url = DUNE_SPV2_AVERAGE_APY_URL_MAINNET;

  // disabled when DUNE_SPV2_AVERAGE_APY_URL_* is null
  if (!url) {
    return null;
  }

  const {
    result: { rows: sevenDaysApys },
  } = await duneFetch({
    apiKey,
    url: `${url}?limit=${branches.length * 7}`,
    validate: isDuneSpAverageApyResponse,
  });

  return Object.fromEntries(
    branches.map((branch) => {
      const apys = sevenDaysApys.filter(
        (row) => row.collateral_type === branch.collSymbol
      );
      return [
        branch.collSymbol,
        {
          apy_avg_1d: apys[0].apr,
          apy_avg_7d: apys.reduce((acc, { apr }) => acc + apr, 0) / apys.length,
        },
      ];
    })
  ) as Record<
    string,
    {
      apy_avg_1d: number;
      apy_avg_7d: number;
    }
  >;
};

export const fetchHistSupplyFromDune = async ({
  apiKey,
  network,
}: {
  apiKey: string;
  network: "bnb" | "mainnet" | "katana";
}) => {
  // TODO use network for different queries
  const url = BOLD_SUPPLY_DAILY_QUERY;

  if (!url) {
    return emptySupplyData();
  }

  const {
    result: { rows: histSupply },
  } = await duneFetch({
    apiKey,
    url: `${url}`,
    validate: isDuneHistoricalSupplyResponse,
  });

  return histSupply.map((daily) => {
    return {
      day: daily.day,
      holders: daily.num_holders,
      supply: daily.token_balance,
    };
  });
};

export const fetchHistCRFromDune = async ({
  apiKey,
  network,
}: {
  apiKey: string;
  network: "bnb" | "mainnet" | "katana";
}) => {
  // TODO use network for different queries
  const url = COLLATERAL_RATIO_QUERY;

  if (!url) {
    return null;
  }

  const {
    result: { rows: histCR },
  } = await duneFetch({
    apiKey,
    url: `${url}`,
    validate: isDuneHistoricalCRResponse,
  });

  return histCR;
};
