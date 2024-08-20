require("@nomicfoundation/hardhat-foundry");
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-truffle5");
require("solidity-coverage");

function accounts() {
  const { accountsList } = require("./hardhatAccountsList2k.js");
  const balanceStr = process.env.ACCOUNTS_BALANCE?.trim();
  return balanceStr
    ? accountsList.map((account) => ({
      ...account,
      balance: String(BigInt(balanceStr) * 10n ** 18n),
    }))
    : accountsList;
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: accounts(),
      gas: 10000000,
      blockGasLimit: 15000000,
      gasPrice: 20000000000,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
    },
  },
};
