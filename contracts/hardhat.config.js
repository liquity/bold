require("@nomicfoundation/hardhat-foundry");
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-truffle5");

const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList;

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
      accounts: accountsList,
      gas: 10000000,
      blockGasLimit: 15000000,
      gasPrice: 20000000000,
      initialBaseFeePerGas: 0,
    },
  },
};
