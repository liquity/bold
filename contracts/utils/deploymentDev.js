const hre = require("hardhat");
const { deployLiquityCoreHardhat, connectCoreContracts } = require("./deploymentHelpers.js");

// Deploy Liquity contracts for development purposes
async function main() {
  const contracts = await deployLiquityCoreHardhat();
  await connectCoreContracts(contracts);

  const accounts = await hre.ethers.getSigners();

  // list of [debt, coll] tuples
  const trovesParams = [
    [1800n * 10n ** 18n, 20n * 10n ** 18n],
    [2800n * 10n ** 18n, 32n * 10n ** 18n],
    [4000n * 10n ** 18n, 30n * 10n ** 18n],
    [6000n * 10n ** 18n, 65n * 10n ** 18n],
    [5000n * 10n ** 18n, 50n * 10n ** 18n],
    [2400n * 10n ** 18n, 37n * 10n ** 18n],
  ];

  // open troves
  await Promise.all(trovesParams.map(async ([debt, coll], index) => {
    const account = await accounts[index].getAddress();
    return contracts.borrowerOperations.openTrove(
      String(100n * 10n ** 16n), // 100%
      String(debt),
      account,
      account,
      String(5n * 10n ** 16n), // 5%
      {
        from: account,
        value: String(coll),
      },
    );
  }));

  let namesWidth = 0;
  const contractsLog = [];
  for (const contract of Object.values(contracts)) {
    const { contractName } = contract.constructor;
    contractsLog.push([contractName, contract.address]);
    namesWidth = Math.max(namesWidth, contractName.length);
  }

  console.log("args", process.argv[1]);

  console.log("");
  console.log("Core contracts deployed.");
  console.log("");
  console.log(
    contractsLog
      .map(([name, address]) => `${name.padEnd(namesWidth)}  ${address}`)
      .join("\n"),
  );
  console.log("");

  console.log("Frontend vars (put this in frontend/*.env):");
  console.log("");
  console.log(
    contractsLog
      .map(([name, address]) => envVarContract(name, address))
      .join("\n"),
  );
  console.log("");
}

function envVarContract(name, address) {
  return `NEXT_PUBLIC_CONTRACT${
    name.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`,
    ).toUpperCase()
  }=${address}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
