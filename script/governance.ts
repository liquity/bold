import { foundry } from "viem/chains";
import { z } from "zod";
import { fs } from "zx";

import { createTestClient, getContract, maxUint256, publicActions, walletActions, webSocket, zeroAddress } from "viem";

import {
  abiBoldToken,
  abiBorrowerOperations,
  abiBribeInitiative,
  abiERC20Faucet,
  abiGovernanceProxy,
  abiPriceFeedTestnet,
  abiWETHTester,
  bytecodeBribeInitiative,
  bytecodeGovernanceProxy,
} from "../abi";

const ANVIL_ACCOUNT_0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const startsWith = <T extends string>(prefix: T) => (x: string): x is `${T}${string}` => x.startsWith(prefix);

const Address = z.string().refine(startsWith("0x"));

const DeploymentManifest = z.object({
  boldToken: Address,

  constants: z.object({
    ETH_GAS_COMPENSATION: z.string(),
    MIN_ANNUAL_INTEREST_RATE: z.string(),
    MIN_DEBT: z.string(),
  }),

  branches: z.object({
    collToken: Address,
    borrowerOperations: Address,
    priceFeed: Address,
  }).array(),

  governance: z.object({
    governance: Address,
    LQTYToken: Address,
  }),
});

const deploymentManifest = DeploymentManifest.parse(fs.readJSONSync("deployment-manifest.json"));

const ETH_GAS_COMPENSATION = BigInt(deploymentManifest.constants.ETH_GAS_COMPENSATION);
const MIN_ANNUAL_INTEREST_RATE = BigInt(deploymentManifest.constants.MIN_ANNUAL_INTEREST_RATE);
const MIN_DEBT = BigInt(deploymentManifest.constants.MIN_DEBT);

const client = createTestClient({
  mode: "anvil",
  chain: foundry,
  account: ANVIL_ACCOUNT_0,
  transport: webSocket(),
})
  .extend(publicActions)
  .extend(walletActions);

const lqtyToken = getContract({
  address: deploymentManifest.governance.LQTYToken,
  abi: abiERC20Faucet,
  client,
});

const boldToken = getContract({
  address: deploymentManifest.boldToken,
  abi: abiBoldToken,
  client,
});

const collToken = getContract({
  address: deploymentManifest.branches[0].collToken,
  abi: abiWETHTester,
  client,
});

const borrowerOperations = getContract({
  address: deploymentManifest.branches[0].borrowerOperations,
  abi: abiBorrowerOperations,
  client,
});

const priceFeed = getContract({
  address: deploymentManifest.branches[0].priceFeed,
  abi: abiPriceFeedTestnet,
  client,
});

const mineOnce = () => {
  const futureBlockTimestamp = new Promise<bigint>((resolve) => {
    const stopWatching = client.watchBlocks({
      onBlock: (block) => {
        stopWatching();
        resolve(block.timestamp);
      },
    });
  });

  client.mine({ blocks: 1 });
  return futureBlockTimestamp;
};

const waitForSuccess = async (hash: `0x${string}`) => {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw Object.assign(new Error("Transaction reverted"), { receipt });
  return receipt;
};

const waitForContractAddress = async (hash: `0x${string}`) => {
  const receipt = await waitForSuccess(hash);
  if (receipt.contractAddress == null) throw Object.assign(new Error("No contract address"), { receipt });
  return receipt.contractAddress;
};

const mintBold = async (to: `0x${string}`, amount: bigint) => {
  const price = await priceFeed.read.getPrice();
  const collAmount = amount * BigInt(2e18) / price;

  await collToken.write.mint([client.account.address, collAmount + ETH_GAS_COMPENSATION]).then(waitForSuccess);
  await collToken.write.approve([borrowerOperations.address, collAmount + ETH_GAS_COMPENSATION]).then(waitForSuccess);

  await borrowerOperations.write.openTrove([
    to, // _owner
    0n, // _ownerIndex
    collAmount, // _ETHAmount
    amount, // _boldAmount
    0n, // _upperHint
    0n, // _lowerHint
    MIN_ANNUAL_INTEREST_RATE, // _annualInterestRate
    maxUint256, // _maxUpfrontFee
    zeroAddress, // _addManager
    zeroAddress, // _removeManager
    zeroAddress, // _receiver
  ]).then(waitForSuccess);

  await boldToken.write.transfer([to, amount]).then(waitForSuccess);
};

const main = async () => {
  const governanceProxy = getContract({
    client,
    abi: abiGovernanceProxy,
    address: await client.deployContract({
      abi: abiGovernanceProxy,
      bytecode: bytecodeGovernanceProxy,
      args: [deploymentManifest.governance.governance],
    }).then(waitForContractAddress),
  });

  const EPOCH_DURATION = await governanceProxy.read.EPOCH_DURATION();
  let epochStart = await governanceProxy.read.epochStart();

  console.log("current epoch:", await governanceProxy.read.epoch());

  const lqtyAmount = BigInt(1_000e18);
  await lqtyToken.write.mint([governanceProxy.address, lqtyAmount]).then(waitForSuccess);
  await governanceProxy.write.depositLQTY([lqtyAmount]).then(waitForSuccess);
  await mintBold(governanceProxy.address, MIN_DEBT);

  // Warp to the beginning of the next epoch
  epochStart += EPOCH_DURATION;
  client.setNextBlockTimestamp({ timestamp: epochStart });
  await mineOnce();

  const bribeInitiative = getContract({
    client,
    abi: abiBribeInitiative,
    address: await client.deployContract({
      abi: abiBribeInitiative,
      bytecode: bytecodeBribeInitiative,
      args: [deploymentManifest.governance.governance, boldToken.address, lqtyToken.address],
    }).then(waitForContractAddress),
  });

  await governanceProxy.write.registerInitiative([bribeInitiative.address]).then(waitForSuccess);

  // Warp to the beginning of the next epoch
  epochStart += EPOCH_DURATION;
  client.setNextBlockTimestamp({ timestamp: epochStart });
  await mineOnce();

  await governanceProxy.write.allocateLQTY([[], [bribeInitiative.address], [lqtyAmount], [0n]]).then(waitForSuccess);
};

main().then(() => {
  // No way to gracefully close the WebSocket in viem?
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
