/** @type {import('next').NextConfig} */
const stylexPlugin = require("@stylexjs/nextjs-plugin");

const nextConfig = {
  output: "export",
  reactStrictMode: false,
  transpilePackages: ["@stylexjs/open-props"],
};

module.exports = stylexPlugin({
  aliases: {
    "@/*": `${__dirname}/*`,
  },
  rootDir: __dirname,
})(nextConfig);
