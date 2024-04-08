const { TestHelper: th } = require("../utils/testHelpers.js");
const { fundAccounts } = require("../utils/fundAccounts.js");

const { dec, toBN } = th;

let latestRandomSeed = 31337;

const TroveManagerTester = artifacts.require("TroveManagerTester");

const INITIAL_PRICE = dec(100, 18);

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

  const getNetBorrowingAmount = async (debtWithFee) =>
    th.getNetBorrowingAmount(contracts, debtWithFee);

  /* Open a Trove for each account. BOLD debt is 200 BOLD each, with collateral beginning at
  1.5 ether, and rising by 0.01 ether per Trove.  Hence, the ICR of account (i + 1) is always 1% greater than the ICR of account i. 
 */

  // Open Troves in parallel, then withdraw BOLD in parallel
  const makeTrovesInParallel = async (accounts, n) => {
    activeAccounts = accounts.slice(0, n);
    // console.log(`number of accounts used is: ${activeAccounts.length}`)
    await fundAccounts(activeAccounts, contracts.WETH);
    // console.time("makeTrovesInParallel")
    const openTrovepromises = activeAccounts.map((account, index) =>
      openTrove(account, index)
    );
    await Promise.all(openTrovepromises);
    const withdrawBoldpromises = activeAccounts.map((account) =>
      withdrawBoldfromTrove(account)
    );
    await Promise.all(withdrawBoldpromises);
    // console.timeEnd("makeTrovesInParallel")
  };

  const openTrove = async (account, index) => {
    const amountFinney = 2000 + index * 10;
    const coll = web3.utils.toWei(amountFinney.toString(), "finney");
    await th.openTroveWrapper(contracts, th._100pct, 0, account, account, {
      from: account,
      value: coll,
    });
  };

  const withdrawBoldfromTrove = async (account) => {
    await borrowerOperations.withdrawBold(
      th._100pct,
      "100000000000000000000",
      account,
      account,
      { from: account }
    );
  };

  // Sequentially add coll and withdraw BOLD, 1 account at a time
  const makeTrovesInSequence = async (accounts, n) => {
    const activeAccounts = accounts.slice(0, n);
    // console.log(`number of accounts used is: ${activeAccounts.length}`)

    let ICR = 200;

    // console.time('makeTrovesInSequence')
    for (const account of activeAccounts) {
      await contracts.WETH.mint(account, toBN(dec(1, 24)));
      const ICR_BN = toBN(ICR.toString().concat("0".repeat(16)));
      await th.openTrove(contracts, {
        extraBoldAmount: toBN(dec(10000, 18)),
        ICR: ICR_BN,
        extraParams: { from: account },
      });

      ICR += 1;
    }
    // console.timeEnd('makeTrovesInSequence')
  };

  const deployFixture = createDeployAndFundFixture({
    accounts: [owner, bountyAddress, lpRewardsAddress, multisig],
    mocks: { TroveManager: TroveManagerTester },
    callback: async (contracts) => {
      await priceFeed.setPrice(INITIAL_PRICE);
      await makeTrovesInSequence(accounts, numAccounts);
      // await makeTrovesInParallel(accounts, numAccounts)
    }
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

  it("setup: makes accounts with nominal ICRs increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const ICR_0 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[0]), INITIAL_PRICE);
    const ICR_1 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[1]), INITIAL_PRICE);
    const ICR_2 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[2]), INITIAL_PRICE);
    const ICR_3 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[3]), INITIAL_PRICE);
    const ICR_4 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[4]), INITIAL_PRICE);
    const ICR_5 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[5]), INITIAL_PRICE);
    const ICR_6 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[6]), INITIAL_PRICE);
    const ICR_7 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[7]), INITIAL_PRICE);
    const ICR_8 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[8]), INITIAL_PRICE);
    const ICR_9 = await troveManager.getCurrentICR(th.addressToTroveId(accounts[9]), INITIAL_PRICE);

    assert.isTrue(ICR_0.eq(toBN(dec(200, 16))));
    assert.isTrue(ICR_1.eq(toBN(dec(201, 16))));
    assert.isTrue(ICR_2.eq(toBN(dec(202, 16))));
    assert.isTrue(ICR_3.eq(toBN(dec(203, 16))));
    assert.isTrue(ICR_4.eq(toBN(dec(204, 16))));
    assert.isTrue(ICR_5.eq(toBN(dec(205, 16))));
    assert.isTrue(ICR_6.eq(toBN(dec(206, 16))));
    assert.isTrue(ICR_7.eq(toBN(dec(207, 16))));
    assert.isTrue(ICR_8.eq(toBN(dec(208, 16))));
    assert.isTrue(ICR_9.eq(toBN(dec(209, 16))));
  });

  it("getApproxHint(): returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts));

    /* As per the setup, the ICRs of Troves are monotonic and seperated by 1% intervals. Therefore, the difference in ICR between 
    the given CR and the ICR of the hint address equals the number of positions between the hint address and the correct insert position 
    for a Trove with the given CR. */

    // CR = 250%
    const CR_250 = "2500000000000000000";
    const CRPercent_250 = Number(web3.utils.fromWei(CR_250, "ether")) * 100;

    let hintId;

      // const hintId_250 = await functionCaller.troveManager_getApproxHint(CR_250, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      CR_250,
      sqrtLength * 10,
      latestRandomSeed
    ));
    const ICR_hintId_250 = await troveManager.getCurrentICR(hintId, INITIAL_PRICE);
    const ICRPercent_hintId_250 =
      Number(web3.utils.fromWei(ICR_hintId_250, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_250 = ICRPercent_hintId_250 - CRPercent_250;
    assert.isBelow(ICR_Difference_250, sqrtLength);

    // CR = 287%
    const CR_287 = "2870000000000000000";
    const CRPercent_287 = Number(web3.utils.fromWei(CR_287, "ether")) * 100;

    // const hintId_287 = await functionCaller.troveManager_getApproxHint(CR_287, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      CR_287,
      sqrtLength * 10,
      latestRandomSeed
    ));
    const ICR_hintId_287 = await troveManager.getCurrentICR(hintId, INITIAL_PRICE);
    const ICRPercent_hintId_287 =
      Number(web3.utils.fromWei(ICR_hintId_287, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_287 = ICRPercent_hintId_287 - CRPercent_287;
    assert.isBelow(ICR_Difference_287, sqrtLength);

    // CR = 213%
    const CR_213 = "2130000000000000000";
    const CRPercent_213 = Number(web3.utils.fromWei(CR_213, "ether")) * 100;

    // const hintId_213 = await functionCaller.troveManager_getApproxHint(CR_213, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      CR_213,
      sqrtLength * 10,
      latestRandomSeed
    ));
    const ICR_hintId_213 = await troveManager.getCurrentICR(hintId, INITIAL_PRICE);
    const ICRPercent_hintId_213 =
      Number(web3.utils.fromWei(ICR_hintId_213, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_213 = ICRPercent_hintId_213 - CRPercent_213;
    assert.isBelow(ICR_Difference_213, sqrtLength);

    // CR = 201%
    const CR_201 = "2010000000000000000";
    const CRPercent_201 = Number(web3.utils.fromWei(CR_201, "ether")) * 100;

    //  const hintId_201 = await functionCaller.troveManager_getApproxHint(CR_201, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      CR_201,
      sqrtLength * 10,
      latestRandomSeed
    ));
    const ICR_hintId_201 = await troveManager.getCurrentICR(hintId, INITIAL_PRICE);
    const ICRPercent_hintId_201 =
      Number(web3.utils.fromWei(ICR_hintId_201, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_201 = ICRPercent_hintId_201 - CRPercent_201;
    assert.isBelow(ICR_Difference_201, sqrtLength);
  });

  /* Pass 100 random collateral ratios to getApproxHint(). For each, check whether the returned hint id is within 
  sqrt(length) positions of where a Trove with that CR should be inserted. */
  // it("getApproxHint(): for 100 random CRs, returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
  //   const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

  //   for (i = 0; i < 100; i++) {
  //     // get random ICR between 200% and (200 + numAccounts)%
  //     const min = 200
  //     const max = 200 + numAccounts
  //     const ICR_Percent = (Math.floor(Math.random() * (max - min) + min))

  //     // Convert ICR to a duint
  //     const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney')

  //     const hintAddress = await hintHelpers.getApproxHint(ICR, sqrtLength * 10)
  //     const ICR_hintAddress = await troveManager.getCurrentICR(hintAddres, INITIAL_PRICES)
  //     const ICRPercent_hintAddress = Number(web3.utils.fromWei(ICR_hintAddress, 'ether')) * 100

  //     // check the hint position is at most sqrtLength positions away from the correct position
  //     ICR_Difference = (ICRPercent_hintAddress - ICR_Percent)
  //     assert.isBelow(ICR_Difference, sqrtLength)
  //   }
  // })

  it("getApproxHint(): returns the head of the list if the CR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts));

    // CR = Maximum value, i.e. 2**256 -1
    const CR_Max =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    let hintId;

      // const hintId_Max = await functionCaller.troveManager_getApproxHint(CR_Max, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      CR_Max,
      sqrtLength * 10,
      latestRandomSeed
    ));

    const ICR_hintId_Max = await troveManager.getCurrentICR(hintId, INITIAL_PRICE);
    const ICRPercent_hintId_Max =
      Number(web3.utils.fromWei(ICR_hintId_Max, "ether")) * 100;

    const firstTrove = await sortedTroves.getFirst();
    const ICR_FirstTrove = await troveManager.getCurrentICR(firstTrove, INITIAL_PRICE);
    const ICRPercent_FirstTrove =
      Number(web3.utils.fromWei(ICR_FirstTrove, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_Max = ICRPercent_hintId_Max - ICRPercent_FirstTrove;
    assert.isBelow(ICR_Difference_Max, sqrtLength);
  });

  it("getApproxHint(): returns the tail of the list if the CR is lower than ICR of any Trove", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts));

    // CR = MCR
    const CR_Min = "1100000000000000000";

    let hintId;

      //  const hintId_Min = await functionCaller.troveManager_getApproxHint(CR_Min, sqrtLength * 10)
    ({ hintId, latestRandomSeed } = await hintHelpers.getApproxHint(
      CR_Min,
      sqrtLength * 10,
      latestRandomSeed
    ));
    const ICR_hintId_Min = await troveManager.getCurrentICR(hintId, INITIAL_PRICE);
    const ICRPercent_hintId_Min =
      Number(web3.utils.fromWei(ICR_hintId_Min, "ether")) * 100;

    const lastTrove = await sortedTroves.getLast();
    const ICR_LastTrove = await troveManager.getCurrentICR(lastTrove, INITIAL_PRICE);
    const ICRPercent_LastTrove =
      Number(web3.utils.fromWei(ICR_LastTrove, "ether")) * 100;

    // check the hint position is at most sqrtLength positions away from the correct position
    const ICR_Difference_Min =
      ICRPercent_hintId_Min - ICRPercent_LastTrove;
    assert.isBelow(ICR_Difference_Min, sqrtLength);
  });
});

// Gas usage:  See gas costs spreadsheet. Cost per trial = 10k-ish.
