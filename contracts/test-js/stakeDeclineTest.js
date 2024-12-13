const { TestHelper: th } = require("../utils/testHelpers.js");
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const { dec, toBN, ZERO_ADDRESS } = th;

let ETH_GAS_COMPENSATION;

/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 *
 */
contract("TroveManager", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 7);

  const [owner, A, B, C, D, E, F] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;
  let priceFeed;
  let boldToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPool;
  let collSurplusPool;
  let defaultPool;
  let borrowerOperations;
  let hintHelpers;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);

  const getSnapshotsRatio = async () => {
    const ratio = (await troveManager.getTotalStakesSnapshot())
      .mul(toBN(dec(1, 18)))
      .div(await troveManager.getTotalCollateralSnapshot());

    return ratio;
  };

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    mocks: { TroveManager: TroveManagerTester },
  });

  beforeEach(async () => {
    const result = await deployFixture();
    contracts = result.contracts;
    priceFeed = contracts.priceFeedTestnet;
    boldToken = contracts.boldToken;
    sortedTroves = contracts.sortedTroves;
    troveManager = contracts.troveManager;
    activePool = contracts.activePool;
    stabilityPool = contracts.stabilityPool;
    defaultPool = contracts.defaultPool;
    collSurplusPool = contracts.collSurplusPool;
    borrowerOperations = contracts.borrowerOperations;
    hintHelpers = contracts.hintHelpers;

    ETH_GAS_COMPENSATION = await contracts.constants._ETH_GAS_COMPENSATION();
  });

  it("A given trove's stake decline is negligible with adjustments and tiny liquidations", async () => {
    await priceFeed.setPrice(dec(100, 18));

    // Make 1 mega troves A at ~50% total collateral
    const ATroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(1, 31)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      { from: A, value: dec(2, 29) },
    );

    // Make 5 large troves B, C, D, E, F at ~10% total collateral
    const BTroveId = await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      { from: B, value: dec(5, 28) },
    );
    await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      { from: C, value: dec(4, 28) },
    );
    await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      { from: D, value: dec(4, 28) },
    );
    await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      { from: E, value: dec(4, 28) },
    );
    await th.openTroveWrapper(
      contracts,
      await getOpenTroveBoldAmount(dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      { from: F, value: dec(4, 28) },
    );

    // Make 10 tiny troves at relatively negligible collateral (~1e-9 of total)
    const tinyTroves = accounts.slice(10, 20);
    const eth_amount = dec(2, 20);
    for (const account of tinyTroves) {
      await contracts.WETH.mint(account, toBN(eth_amount).add(ETH_GAS_COMPENSATION));
      await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(1, 22)),
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        0,
        { from: account, value: eth_amount },
      );
    }

    // liquidate 1 trove at ~50% total system collateral
    await priceFeed.setPrice(dec(50, 18));
    assert.isTrue(
      await troveManager.checkBelowCriticalThreshold(await priceFeed.getPrice()),
    );
    await troveManager.liquidate(ATroveId);

    // console.log(
    //   `totalStakesSnapshot after L1: ${await troveManager.getTotalStakesSnapshot()}`
    // );
    // console.log(
    //   `totalCollateralSnapshot after L1: ${await troveManager.getTotalCollateralSnapshot()}`
    // );
    // console.log(`Snapshots ratio after L1: ${await getSnapshotsRatio()}`);
    // console.log(
    //   `B pending ETH reward after L1: ${await troveManager.getPendingCollReward(
    //     B
    //   )}`
    // );
    // console.log(`B stake after L1: ${(await troveManager.Troves(BTroveId))[2]}`);

    // adjust trove B 1 wei: apply rewards
    await borrowerOperations.adjustTrove(
      BTroveId,
      0,
      false,
      1,
      false,
      th.MAX_UINT256,
      { from: B },
    ); // B repays 1 wei
    // console.log(`B stake after A1: ${(await troveManager.Troves(BTroveId))[2]}`);
    // console.log(`Snapshots ratio after A1: ${await getSnapshotsRatio()}`);

    // Loop over tiny troves, and alternately:
    // - Liquidate a tiny trove
    // - Adjust B's collateral by 1 wei
    for (let [idx, trove] of tinyTroves.entries()) {
      await troveManager.liquidate(th.addressToTroveId(trove));
      // console.log(
      //   `B stake after L${idx + 2}: ${(await troveManager.Troves(BTroveId))[2]}`
      // );
      // console.log(
      //   `Snapshots ratio after L${idx + 2}: ${await getSnapshotsRatio()}`
      // );
      await borrowerOperations.adjustTrove(
        BTroveId,
        0,
        false,
        1,
        false,
        th.MAX_UINT256,
        { from: B },
      ); // A repays 1 wei
      // console.log(
      //   `B stake after A${idx + 2}: ${(await troveManager.Troves(B))[2]}`
      // );
    }
  });

  // TODO: stake decline for adjustments with sizable liquidations, for comparison
});
