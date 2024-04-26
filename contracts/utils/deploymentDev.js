const hre = require("hardhat");
const { deployLiquityCoreHardhat, connectCoreContracts } = require("./deploymentHelpers.js");

// Deploy Liquity contracts for development purposes
async function main() {
  const contracts = await deployLiquityCoreHardhat();
  await connectCoreContracts(contracts);

  const accounts = await hre.ethers.getSigners();

  // list of [debt, coll] tuples
  const trovesParams = [
    [1_800n, 20n],
    [2_800n, 32n],
    [4_000n, 30n],
    [6_000n, 65n],
    [5_000n, 50n],
    [2_400n, 37n],
  ];

  // open troves
  await Promise.all(trovesParams.map(async ([debt, coll], index) => {
    const account = await accounts[index].getAddress();
    return contracts.borrowerOperations.openTrove(
      String(100n * 10n ** 16n), // 100%
      String(debt * 10n ** 18n),
      account,
      account,
      String(5n * 10n ** 16n), // 5%
      {
        from: account,
        value: String(coll * 10n ** 18n),
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
  const envVarEnd = name.replace(/[A-Z]/g, (s) => "_" + s);
  return `NEXT_PUBLIC_CONTRACT${envVarEnd.toUpperCase()}=${address}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
