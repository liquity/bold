const pkg = require("./package.json");

const commitHash = require("child_process")
  .execSync("git log --pretty=format:\"%h\" -n1")
  .toString()
  .trim();

/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  reactStrictMode: false,
  env: {
    APP_VERSION: pkg.version,
    COMMIT_HASH: commitHash,
  },
};
