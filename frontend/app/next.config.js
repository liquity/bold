import bundleAnalyzer from "@next/bundle-analyzer";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const commitHash = execSync("git log --pretty=format:\"%h\" -n1")
  .toString()
  .trim();

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
export default withBundleAnalyzer({
  output: "export",
  reactStrictMode: false,
  images: { unoptimized: true },
  env: {
    APP_VERSION: pkg.version,
    COMMIT_HASH: commitHash,
  },
  webpack: (config) => {
    // required for rainbowkit
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/known-initiatives/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Origin, Content-Type, Accept" },
        ],
      },
    ];
  },
});
