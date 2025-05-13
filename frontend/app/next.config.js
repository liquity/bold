import bundleAnalyzer from "@next/bundle-analyzer";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const commitHashCmd = "git log -1 --pretty=format:%h";

const APP_VERSION_FROM_BUILD = JSON.parse(
  readFileSync("./package.json", "utf-8"),
).version;
const APP_COMMIT_HASH_FROM_BUILD = String(execSync(
  commitHashCmd + " -- ./ ../uikit/",
)).trim();
const CONTRACTS_COMMIT_HASH_FROM_BUILD = String(execSync(
  commitHashCmd + " -- ../../contracts/addresses/11155111.json",
)).trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: false,
  images: { unoptimized: true },
  trailingSlash: flag(process.env.NEXT_TRAILING_SLASH),
  env: {
    APP_VERSION_FROM_BUILD,
    APP_COMMIT_HASH_FROM_BUILD,
    CONTRACTS_COMMIT_HASH_FROM_BUILD,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default (process.env.ANALYZE === "true" ? bundleAnalyzer(nextConfig) : nextConfig);

function flag(value) {
  if (typeof value !== "string") {
    return false;
  }
  value = value.trim();
  return value === "true" || value === "1" || value === "yes";
}
