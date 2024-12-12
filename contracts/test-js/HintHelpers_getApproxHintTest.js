const testHelpers = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol");

const { dec, toBN } = testHelpers.TestHelper;
const th = testHelpers.TestHelper;

let latestRandomSeed = 31337;

contract("HintHelpers", async (accounts) => {
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let sortedTroves;
  let troveManager;
  let borrowerOperations;
  let hintHelpers;
  let priceFeed;

  let contracts;

  let numAccounts = 10;

  // Sequentially add coll and withdraw BOLD, 1 account at a time
  const makeTrovesInSequence = async (contracts, accounts, n) => {
    const activeAccounts = accounts.slice(0, n);
    // console.log(`number of accounts used is: ${activeAccounts.length}`)

    let IR = 5;

    // console.time('makeTrovesInSequence')
    for (const account of activeAccounts) {
      await contracts.WETH.mint(account, toBN(dec(1, 24)));
      const IR_BN = toBN(IR.toString().concat("0".repeat(16)));
      await th.openTrove(contracts, {
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(200, 16)),
        extraParams: { from: account, annualInterestRate: IR_BN },
      });

      IR += 1;
    }
    // console.timeEnd('makeTrovesInSequence')
  };

  const deployFixture = createDeployAndFundFixture({
    accounts: [owner, bountyAddress, lpRewardsAddress, multisig],
    mocks: { TroveManager: TroveManagerTester },
    callback: async (contracts) => {
      await makeTrovesInSequence(contracts, accounts, numAccounts);
    },
  });

  beforeEach(async () => {
    const result = await deployFixture();
    contracts = result.contracts;
    sortedTroves = contracts.sortedTroves;
    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations;
    hintHelpers = contracts.hintHelpers;
    priceFeed = contracts.priceFeedTestnet;
  });

  it("setup: makes accounts with Interest rate increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const IR_0 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[0]));
    const IR_1 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[1]));
    const IR_2 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[2]));
    const IR_3 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[3]));
    const IR_4 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[4]));
    const IR_5 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[5]));
    const IR_6 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[6]));
    const IR_7 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[7]));
    const IR_8 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[8]));
    const IR_9 = await troveManager.getTroveAnnualInterestRate(th.addressToTroveId(accounts[9]));

    assert.isTrue(IR_0.eq(toBN(dec(5, 16))));
    assert.isTrue(IR_1.eq(toBN(dec(6, 16))));
    assert.isTrue(IR_2.eq(toBN(dec(7, 16))));
    assert.isTrue(IR_3.eq(toBN(dec(8, 16))));
    assert.isTrue(IR_4.eq(toBN(dec(9, 16))));
    assert.isTrue(IR_5.eq(toBN(dec(10, 16))));
    assert.isTrue(IR_6.eq(toBN(dec(11, 16))));
    assert.isTrue(IR_7.eq(toBN(dec(12, 16))));
    assert.isTrue(IR_8.eq(toBN(dec(13, 16))));
    assert.isTrue(IR_9.eq(toBN(dec(14, 16))));
  });

  it("getApproxHint(): returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts));

    /* As per the setup, the IRs of Troves are monotonic and seperated by 1% intervals. Therefore, the difference in IR between
    the given IR and the IR of the hint address equals the number of positions between the hint address and the correct insert position
    for a Trove with the given IR. */

    // IR = 55%
    const IR_55 = "550000000000000000";
    const IRPercent_55 = Number(web3.utils.fromWei(IR_55, "ether")) * 100;

    let hintId;

    // const hintId_55 = await functionCaller.troveManager_getApproxHint(IR_55, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(0, IR_55, sqrtLength * 10, latestRandomSeed));
    const IR_hintId_55 = await troveManager.getTroveAnnualInterestRate(hintId);
    const IRPercent_hintId_55 = Number(web3.utils.fromWei(IR_hintId_55, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    const IR_Difference_55 = IRPercent_hintId_55 - IRPercent_55;
    assert.isBelow(IR_Difference_55, sqrtLength);

    // IR = 92%
    const IR_92 = "920000000000000000";
    const IRPercent_92 = Number(web3.utils.fromWei(IR_92, "ether")) * 100;

    // const hintId_92 = await functionCaller.troveManager_getApproxHint(IR_92, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(0, IR_92, sqrtLength * 10, latestRandomSeed));
    const IR_hintId_92 = await troveManager.getTroveAnnualInterestRate(hintId);
    const IRPercent_hintId_92 = Number(web3.utils.fromWei(IR_hintId_92, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    const IR_Difference_92 = IRPercent_hintId_92 - IRPercent_92;
    assert.isBelow(IR_Difference_92, sqrtLength);

    // IR = 18%
    const IR_18 = "180000000000000000";
    const IRPercent_18 = Number(web3.utils.fromWei(IR_18, "ether")) * 100;

    // const hintId_18 = await functionCaller.troveManager_getApproxHint(IR_18, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(0, IR_18, sqrtLength * 10, latestRandomSeed));
    const IR_hintId_18 = await troveManager.getTroveAnnualInterestRate(hintId);
    const IRPercent_hintId_18 = Number(web3.utils.fromWei(IR_hintId_18, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    const IR_Difference_18 = IRPercent_hintId_18 - IRPercent_18;
    assert.isBelow(IR_Difference_18, sqrtLength);

    // IR = 6%
    const IR_6 = "60000000000000000";
    const IRPercent_6 = Number(web3.utils.fromWei(IR_6, "ether")) * 100;

    //  const hintId_6 = await functionCaller.troveManager_getApproxHint(IR_6, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(0, IR_6, sqrtLength * 10, latestRandomSeed));
    const IR_hintId_6 = await troveManager.getTroveAnnualInterestRate(hintId);
    const IRPercent_hintId_6 = Number(web3.utils.fromWei(IR_hintId_6, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    const IR_Difference_6 = IRPercent_hintId_6 - IRPercent_6;
    assert.isBelow(IR_Difference_6, sqrtLength);
  });

  /* Pass 100 random collateral ratios to getApproxHint(). For each, check whether the returned hint id is within
  sqrt(length) positions of where a Trove with that IR should be inserted. */
  // it("getApproxHint(): for 100 random IRs, returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
  //   const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

  //   for (i = 0; i < 100; i++) {
  //     // get random IR between 200% and (200 + numAccounts)%
  //     const min = 200
  //     const max = 200 + numAccounts
  //     const IR_Percent = (Math.floor(Math.random() * (max - min) + min))

  //     // Convert IR to a duint
  //     const IR = web3.utils.toWei((IR_Percent * 10).toString(), 'finney')

  //     const hintAddress = await hintHelpers.getApproxHint(IR, sqrtLength * 10)
  //     const IR_hintAddress = await troveManager.getTroveAnnualInterestRate(hintAddresS)
  //     const IRPercent_hintAddress = Number(web3.utils.fromWei(IR_hintAddress, 'ether')) * 100

  //     // check the hint position is at most sqrtLength positions away from the correct position
  //     IR_Difference = (IRPercent_hintAddress - IR_Percent)
  //     assert.isBelow(IR_Difference, sqrtLength)
  //   }
  // })

  it("getApproxHint(): returns the head of the list if the IR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts));

    let hintId;

    // const hintId_Max = await functionCaller.troveManager_getApproxHint(IR_Max, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      0,
      th.MAX_UINT256,
      sqrtLength * 10,
      latestRandomSeed,
    ));

    const IR_hintId_Max = await troveManager.getTroveAnnualInterestRate(hintId);
    const IRPercent_hintId_Max = Number(web3.utils.fromWei(IR_hintId_Max, "ether")) * 100;

    const firstTrove = await sortedTroves.getFirst();
    const IR_FirstTrove = await troveManager.getTroveAnnualInterestRate(firstTrove);
    const IRPercent_FirstTrove = Number(web3.utils.fromWei(IR_FirstTrove, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    IR_Difference_Max = IRPercent_hintId_Max - IRPercent_FirstTrove;
    assert.isBelow(IR_Difference_Max, sqrtLength);
  });

  it("getApproxHint(): returns the tail of the list if the IR is lower than IR of any Trove", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts));

    // IR = 3%
    const IR_Min = "30000000000000000";

    let hintId;

    //  const hintId_Min = await functionCaller.troveManager_getApproxHint(IR_Min, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(0, IR_Min, sqrtLength * 10, latestRandomSeed));
    const IR_hintId_Min = await troveManager.getTroveAnnualInterestRate(hintId);
    const IRPercent_hintId_Min = Number(web3.utils.fromWei(IR_hintId_Min, "ether")) * 100;

    const lastTrove = await sortedTroves.getLast();
    const IR_LastTrove = await troveManager.getTroveAnnualInterestRate(lastTrove);
    const IRPercent_LastTrove = Number(web3.utils.fromWei(IR_LastTrove, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    const IR_Difference_Min = IRPercent_hintId_Min - IRPercent_LastTrove;
    assert.isBelow(IR_Difference_Min, sqrtLength);
  });
});

// Gas usage:  See gas costs spreadsheet. Cost per trial = 10k-ish.
