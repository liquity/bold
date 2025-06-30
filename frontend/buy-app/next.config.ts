import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
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
          {
            key: "Access-Control-Allow-Headers",
            value: "Origin, Content-Type, Accept",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
