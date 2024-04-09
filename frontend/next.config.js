/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  reactStrictMode: false,
  webpack: (config) => {
    // RainbowKit related dependencies
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};
