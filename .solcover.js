module.exports = {
  // Improve performance by skipping statements and functions. Tool still checks lines of code and branches:
  // https://github.com/sc-forks/solidity-coverage/blob/master/docs/advanced.md
  // measureStatementCoverage: false,
  // measureFunctionCoverage: false,

  skipFiles: [
    "GasPool",
    "test/",
    "TestContracts/",
    "Interfaces/",
    "Dependencies/IERC20.sol",
    "Dependencies/IERC2612.sol",
    "Dependencies/Math.sol",
    "Dependencies/Ownable.sol",
    "Dependencies/",
    "Integrations/",
  ],
  // https://github.com/sc-forks/solidity-coverage/blob/master/docs/advanced.md#skipping-tests
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
  contractsDir: "src/",
};
