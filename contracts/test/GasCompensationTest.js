const { TestHelper: th, MoneyValues: mv } = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol");
const BorrowerOperationsTester = artifacts.require(
  "./BorrowerOperationsTester.sol",
);
const ERC20 = artifacts.require("./ERC20MinterMock.sol");

const { dec, toBN, ZERO_ADDRESS } = th;

const GAS_PRICE = 10000000;
const ONE = toBN(dec(1, 18));
let ETH_GAS_COMPENSATION;

contract("Gas compensation tests", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 16);

  const [
    owner,
    liquidator,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet,
    ida,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    whale,
  ] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;

  let priceFeed;
  let boldToken;
  let troveManager;
  let stabilityPool;
  let borrowerOperations;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const openTrove = async (params) => th.openTrove(contracts, params);

  const logICRs = (ICRList) => {
    for (let i = 0; i < ICRList.length; i++) {
      console.log(`account: ${i + 1} ICR: ${ICRList[i].toString()}`);
    }
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
    troveManager = contracts.troveManager;
    stabilityPool = contracts.stabilityPool;
    borrowerOperations = contracts.borrowerOperations;

    ETH_GAS_COMPENSATION = await contracts.constants._ETH_GAS_COMPENSATION();
  });

  // --- Raw gas compensation calculations ---

  it("_getCollGasCompensation(): returns the 0.5% of collaterall if it is < $10 in value", async () => {
    /*
    ETH:USD price = 1
    coll = 1 ETH: $1 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice(dec(1, 18));
    // const price_1 = await priceFeed.getPrice()
    const gasCompensation_1 = (
      await troveManager.getCollGasCompensation(dec(1, "ether"))
    ).toString();
    assert.equal(gasCompensation_1, dec(5, 15));

    /*
    ETH:USD price = 28.4
    coll = 0.1 ETH: $2.84 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice("28400000000000000000");
    // const price_2 = await priceFeed.getPrice()
    const gasCompensation_2 = (
      await troveManager.getCollGasCompensation(dec(100, "finney"))
    ).toString();
    assert.equal(gasCompensation_2, dec(5, 14));

    /*
    ETH:USD price = 1000000000 (1 billion)
    coll = 0.000000005 ETH (5e9 wei): $5 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice(dec(1, 27));
    // const price_3 = await priceFeed.getPrice()
    const gasCompensation_3 = (
      await troveManager.getCollGasCompensation("5000000000")
    ).toString();
    assert.equal(gasCompensation_3, "25000000");
  });

  it("_getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral < $10 in value", async () => {
    const price = await priceFeed.getPrice();
    assert.equal(price, dec(200, 18));

    /*
    ETH:USD price = 200
    coll = 9.999 ETH
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_1 = (
      await troveManager.getCollGasCompensation("9999000000000000000")
    ).toString();
    assert.equal(gasCompensation_1, "49995000000000000");

    /* ETH:USD price = 200
     coll = 0.055 ETH
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_2 = (
      await troveManager.getCollGasCompensation("55000000000000000")
    ).toString();
    assert.equal(gasCompensation_2, dec(275, 12));

    /* ETH:USD price = 200
    coll = 6.09232408808723580 ETH
    0.5% of coll = 0.004995 ETH. USD value: $6.09
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_3 = (
      await troveManager.getCollGasCompensation("6092324088087235800")
    ).toString();
    assert.equal(gasCompensation_3, "30461620440436179");
  });

  it("getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value", async () => {
    const price = await priceFeed.getPrice();
    assert.equal(price, dec(200, 18));

    /*
    ETH:USD price = 200
    coll = 10 ETH
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation = (
      await troveManager.getCollGasCompensation(dec(10, "ether"))
    ).toString();
    assert.equal(gasCompensation, "50000000000000000");
  });

  it("getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value", async () => {
    const price = await priceFeed.getPrice();
    assert.equal(price, dec(200, 18));

    /*
    ETH:USD price = 200 $/E
    coll = 100 ETH
    0.5% of coll = 0.5 ETH. USD value: $100
    -> Expect $100 gas compensation, i.e. 0.5 ETH */
    const gasCompensation_1 = (
      await troveManager.getCollGasCompensation(dec(100, "ether"))
    ).toString();
    assert.equal(gasCompensation_1, dec(500, "finney"));

    /*
    ETH:USD price = 200 $/E
    coll = 10.001 ETH
    0.5% of coll = 0.050005 ETH. USD value: $10.001
    -> Expect $100 gas compensation, i.e.  0.050005  ETH */
    const gasCompensation_2 = (
      await troveManager.getCollGasCompensation("10001000000000000000")
    ).toString();
    assert.equal(gasCompensation_2, "50005000000000000");

    /*
    ETH:USD price = 200 $/E
    coll = 37.5 ETH
    0.5% of coll = 0.1875 ETH. USD value: $37.5
    -> Expect $37.5 gas compensation i.e.  0.1875  ETH */
    const gasCompensation_3 = (
      await troveManager.getCollGasCompensation("37500000000000000000")
    ).toString();
    assert.equal(gasCompensation_3, "187500000000000000");

    /*
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH
    0.5% of coll = 473.7911529 ETH. USD value: $21473894.84
    -> Expect $21473894.8385808 gas compensation, i.e.  473.7911529115490  ETH
    EDIT: now capped at 2 ETH
    */
    await priceFeed.setPrice("45323545420000000000000");
    const gasCompensation_4 = await troveManager.getCollGasCompensation(
      "94758230582309850000000",
    );
    assert.isAtMost(
      th.getDifference(gasCompensation_4, toBN(dec(2, 18))),
      1000000,
    );

    /*
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    0.5% of coll = 1500000 ETH. USD value: $150000000000
    -> Expect $150000000000 gas compensation, i.e. 1500000 ETH */
    await priceFeed.setPrice(dec(1, 24));
    const price_2 = await priceFeed.getPrice();
    const gasCompensation_5 = (
      await troveManager.getCollGasCompensation(
        "300000000000000000000000000",
      )
    ).toString();
    assert.equal(gasCompensation_5, toBN(dec(2, 18)));
  });

  // --- Test ICRs with virtual debt ---
  it("getCurrentICR(): Incorporates virtual debt, and returns the correct ICR for new troves", async () => {
    const price = await priceFeed.getPrice();
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } });

    // A opens with 1 ETH, 110 Bold
    const { troveId: aliceTroveId } = await openTrove({
      ICR: toBN("1818181818181818181"),
      extraParams: { from: alice },
    });
    const alice_ICR = (
      await troveManager.getCurrentICR(aliceTroveId, price)
    ).toString();
    // Expect aliceICR = (1 * 200) / (110) = 181.81%
    assert.isAtMost(th.getDifference(alice_ICR, "1818181818181818181"), 1000);

    // B opens with 0.5 ETH, 50 Bold
    const { troveId: bobTroveId } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } });
    const bob_ICR = (await troveManager.getCurrentICR(bobTroveId, price)).toString();
    // Expect Bob's ICR = (0.5 * 200) / 50 = 200%
    assert.isAtMost(th.getDifference(bob_ICR, dec(2, 18)), 1000);

    // F opens with 1 ETH, 100 Bold
    const { troveId: flynTroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: flyn },
    });
    const flyn_ICR = (await troveManager.getCurrentICR(flynTroveId, price)).toString();
    // Expect Flyn's ICR = (1 * 200) / 100 = 200%
    assert.isAtMost(th.getDifference(flyn_ICR, dec(2, 18)), 1000);

    // C opens with 2.5 ETH, 160 Bold
    const { troveId: carolTroveId } = await openTrove({ ICR: toBN(dec(3125, 15)), extraParams: { from: carol } });
    const carol_ICR = (
      await troveManager.getCurrentICR(carolTroveId, price)
    ).toString();
    // Expect Carol's ICR = (2.5 * 200) / (160) = 312.50%
    assert.isAtMost(th.getDifference(carol_ICR, "3125000000000000000"), 1000);

    // D opens with 1 ETH, 0 Bold
    const { troveId: dennisTroveId } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: dennis } });
    const dennis_ICR = (
      await troveManager.getCurrentICR(dennisTroveId, price)
    ).toString();
    // Expect Dennis's ICR = (1 * 200) / (50) = 400.00%
    assert.isAtMost(th.getDifference(dennis_ICR, dec(4, 18)), 1000);

    // E opens with 4405.45 ETH, 32598.35 Bold
    const { troveId: erinTroveId } = await openTrove({
      ICR: toBN("27028668628933700000"),
      extraParams: { from: erin },
    });
    const erin_ICR = (await troveManager.getCurrentICR(erinTroveId, price)).toString();
    // Expect Erin's ICR = (4405.45 * 200) / (32598.35) = 2702.87%
    assert.isAtMost(th.getDifference(erin_ICR, "27028668628933700000"), 100000);

    // H opens with 1 ETH, 180 Bold
    const { troveId: harrietTroveId } = await openTrove({
      ICR: toBN("1111111111111111111"),
      extraParams: { from: harriet },
    });
    const harriet_ICR = (
      await troveManager.getCurrentICR(harrietTroveId, price)
    ).toString();
    // Expect Harriet's ICR = (1 * 200) / (180) = 111.11%
    assert.isAtMost(th.getDifference(harriet_ICR, "1111111111111111111"), 1000);
  });

  // Test compensation amounts and liquidation amounts

  it("Gas compensation from pool-offset liquidations. All collateral paid as compensation", async () => {
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } });

    // A-E open troves
    const { troveId: aliceTroveId, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(200, 18),
      extraParams: { from: bob },
    });
    const { troveId: carolTroveId, totalDebt: C_totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(300, 18),
      extraParams: { from: carol },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: A_totalDebt,
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: B_totalDebt.add(C_totalDebt),
      extraParams: { from: erin },
    });

    // D, E each provide Bold to SP
    await th.provideToSPAndClaim(contracts, A_totalDebt, {
      from: dennis,
      gasPrice: GAS_PRICE,
    });
    await th.provideToSPAndClaim(contracts, B_totalDebt.add(C_totalDebt), { from: erin, gasPrice: GAS_PRICE });

    const BoldinSP_0 = await stabilityPool.getTotalBoldDeposits();

    // --- Price drops to 9.99 ---
    await priceFeed.setPrice("9990000000000000000");
    const price_1 = await priceFeed.getPrice();

    /*
    ETH:USD price = 9.99
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const aliceColl = (await troveManager.Troves(aliceTroveId))[1];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(aliceTroveId, { from: liquidator });
    const liquidatorBalance_after_A = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by 0.5% of A's coll (1 ETH)
    const compensationReceived_A = liquidatorBalance_after_A
          .sub(liquidatorBalance_before_A).sub(ETH_GAS_COMPENSATION)
          .toString();
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN("200"));
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl.toString());

    // Check SP Bold has decreased due to the liquidation
    const BoldinSP_A = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_A.lte(BoldinSP_0));

    // Check ETH in SP has received the liquidation
    const ETHinSP_A = await stabilityPool.getCollBalance();
    assert.equal(ETHinSP_A.toString(), aliceColl.sub(_0pt5percent_aliceColl)); // 1 ETH - 0.5%

    // --- Price drops to 3 ---
    await priceFeed.setPrice(dec(3, 18));
    const price_2 = await priceFeed.getPrice();

    /*
    ETH:USD price = 3
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const bobColl = (await troveManager.Troves(bobTroveId))[1];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(bobTroveId, { from: liquidator });
    const liquidatorBalance_after_B = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by B's 0.5% of coll, 2 ETH
    const compensationReceived_B = liquidatorBalance_after_B
      .sub(liquidatorBalance_before_B).sub(ETH_GAS_COMPENSATION)
      .toString();
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN("200"));
    assert.equal(compensationReceived_B, _0pt5percent_bobColl.toString()); // 0.5% of 2 ETH

    // Check SP Bold has decreased due to the liquidation of B
    const BoldinSP_B = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_B.lt(BoldinSP_A));

    // Check ETH in SP has received the liquidation
    const ETHinSP_B = await stabilityPool.getCollBalance();
    assert.equal(
      ETHinSP_B.toString(),
      aliceColl
        .sub(_0pt5percent_aliceColl)
        .add(bobColl)
        .sub(_0pt5percent_bobColl),
    ); // (1 + 2 ETH) * 0.995

    // --- Price drops to 3 ---
    await priceFeed.setPrice("3141592653589793238");
    const price_3 = await priceFeed.getPrice();

    /*
    ETH:USD price = 3.141592653589793238
    Carol coll = 3 ETH. Value = (3 * 3.141592653589793238) = $6
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const carolColl = (await troveManager.Troves(carolTroveId))[1];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_C = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(carolTroveId, { from: liquidator });
    const liquidatorBalance_after_C = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by C's 0.5% of coll, 3 ETH
    const compensationReceived_C = liquidatorBalance_after_C
          .sub(liquidatorBalance_before_C).sub(ETH_GAS_COMPENSATION)
          .toString();
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN("200"));
    assert.equal(compensationReceived_C, _0pt5percent_carolColl.toString());

    // Check SP Bold has decreased due to the liquidation of C
    const BoldinSP_C = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_C.lt(BoldinSP_B));

    // Check ETH in SP has not changed due to the lquidation of C
    const ETHinSP_C = await stabilityPool.getCollBalance();
    assert.equal(
      ETHinSP_C.toString(),
      aliceColl
        .sub(_0pt5percent_aliceColl)
        .add(bobColl)
        .sub(_0pt5percent_bobColl)
        .add(carolColl)
        .sub(_0pt5percent_carolColl),
    ); // (1+2+3 ETH) * 0.995
  });

  it("gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Compensates $10 worth of collateral, liquidates the remainder", async () => {
    await priceFeed.setPrice(dec(400, 18));
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } });

    // A-E open troves
    const { troveId: aliceTroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(200, 18),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(120, 16)),
      extraBoldAmount: dec(5000, 18),
      extraParams: { from: bob },
    });
    await openTrove({
      ICR: toBN(dec(60, 18)),
      extraBoldAmount: dec(600, 18),
      extraParams: { from: carol },
    });
    await openTrove({
      ICR: toBN(dec(80, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(80, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: erin },
    });

    // D, E each provide 10000 Bold to SP
    await th.provideToSPAndClaim(contracts, dec(1, 23), {
      from: dennis,
      gasPrice: GAS_PRICE,
    });
    await th.provideToSPAndClaim(contracts, dec(1, 23), {
      from: erin,
      gasPrice: GAS_PRICE,
    });

    const BoldinSP_0 = await stabilityPool.getTotalBoldDeposits();
    const ETHinSP_0 = await stabilityPool.getCollBalance();

    // --- Price drops to 199.999 ---
    await priceFeed.setPrice("199999000000000000000");
    const price_1 = await priceFeed.getPrice();

    /*
    ETH:USD price = 199.999
    Alice coll = 1 ETH. Value: $199.999
    0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
    Minimum comp = $10 = 0.05000025000125001 ETH.
    -> Expect 0.05000025000125001 ETH sent to liquidator,
    and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const aliceColl = (await troveManager.Troves(aliceTroveId))[1];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const aliceICR = await troveManager.getCurrentICR(aliceTroveId, price_1);
    assert.isTrue(aliceICR.lt(mv._MCR));

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(aliceTroveId, { from: liquidator });
    const liquidatorBalance_after_A = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_A = liquidatorBalance_after_A
          .sub(liquidatorBalance_before_A).sub(ETH_GAS_COMPENSATION)
          .toString();
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN("200"));
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl.toString());

    // Check SP Bold has decreased due to the liquidation of A
    const BoldinSP_A = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_A.lt(BoldinSP_0));

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl);
    const ETHinSP_A = await stabilityPool.getCollBalance();

    const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0);

    assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000);

    // --- Price drops to 15 ---
    await priceFeed.setPrice(dec(15, 18));
    const price_2 = await priceFeed.getPrice();

    /*
    ETH:USD price = 15
    Bob coll = 15 ETH. Value: $165
    0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
    Minimum comp = $10 =  0.66666...ETH.
    -> Expect 0.666666666666666666 ETH sent to liquidator,
    and (15 - 0.666666666666666666) ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const bobColl = (await troveManager.Troves(bobTroveId))[1];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const bobICR = await troveManager.getCurrentICR(bobTroveId, price_2);
    assert.isTrue(bobICR.lte(mv._MCR));

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(bobTroveId, { from: liquidator });
    const liquidatorBalance_after_B = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by $10 worth of coll
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN("200"));
    const compensationReceived_B = liquidatorBalance_after_B
      .sub(liquidatorBalance_before_B).sub(ETH_GAS_COMPENSATION)
      .toString();
    assert.equal(compensationReceived_B, _0pt5percent_bobColl.toString());

    // Check SP Bold has decreased due to the liquidation of B
    const BoldinSP_B = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_B.lt(BoldinSP_A));

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_B = bobColl.sub(_0pt5percent_bobColl);
    const ETHinSP_B = await stabilityPool.getCollBalance();

    const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A);

    assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000);
  });

  it("gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Compensates 0.5% of  collateral, liquidates the remainder", async () => {
    // open troves
    await priceFeed.setPrice(dec(400, 18));
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } });

    // A-E open troves
    const { troveId: aliceTroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(1875, 15)),
      extraBoldAmount: dec(8000, 18),
      extraParams: { from: bob },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(600, 18),
      extraParams: { from: carol },
    });
    await openTrove({
      ICR: toBN(dec(4, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(4, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: erin },
    });

    // D, E each provide 10000 Bold to SP
    await th.provideToSPAndClaim(contracts, dec(1, 23), {
      from: dennis,
      gasPrice: GAS_PRICE,
    });
    await th.provideToSPAndClaim(contracts, dec(1, 23), {
      from: erin,
      gasPrice: GAS_PRICE,
    });

    const BoldinSP_0 = await stabilityPool.getTotalBoldDeposits();
    const ETHinSP_0 = await stabilityPool.getCollBalance();

    await priceFeed.setPrice(dec(200, 18));
    const price_1 = await priceFeed.getPrice();

    /*
    ETH:USD price = 200
    Alice coll = 10.001 ETH. Value: $2000.2
    0.5% of coll  = 0.050005 ETH. Value: (0.050005 * 200) = $10.01
    Minimum comp = $10 = 0.05 ETH.
    -> Expect  0.050005 ETH sent to liquidator,
    and (10.001 - 0.050005) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const aliceColl = (await troveManager.Troves(aliceTroveId))[1];
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN("200"));

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const aliceICR = await troveManager.getCurrentICR(aliceTroveId, price_1);
    assert.isTrue(aliceICR.lt(mv._MCR));

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(aliceTroveId, { from: liquidator });
    const liquidatorBalance_after_A = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_A = liquidatorBalance_after_A
          .sub(liquidatorBalance_before_A).sub(ETH_GAS_COMPENSATION)
          .toString();
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl.toString());

    // Check SP Bold has decreased due to the liquidation of A
    const BoldinSP_A = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_A.lt(BoldinSP_0));

    // Check ETH in SP has increased by the remainder of A's coll
    const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl);
    const ETHinSP_A = await stabilityPool.getCollBalance();

    const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0);

    assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000);

    /*
   ETH:USD price = 200
   Bob coll = 37.5 ETH. Value: $7500
   0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
   Minimum comp = $10 = 0.05 ETH.
   -> Expect 0.1875 ETH sent to liquidator,
   and (37.5 - 0.1875 ETH) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const bobColl = (await troveManager.Troves(bobTroveId))[1];
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN("200"));

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const bobICR = await troveManager.getCurrentICR(bobTroveId, price_1);
    assert.isTrue(bobICR.lt(mv._MCR));

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );
    await troveManager.liquidate(bobTroveId, { from: liquidator });
    const liquidatorBalance_after_B = web3.utils.toBN(
      await contracts.WETH.balanceOf(liquidator),
    );

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_B = liquidatorBalance_after_B
          .sub(liquidatorBalance_before_B).sub(ETH_GAS_COMPENSATION)
          .toString();
    assert.equal(compensationReceived_B, _0pt5percent_bobColl.toString());

    // Check SP Bold has decreased due to the liquidation of B
    const BoldinSP_B = await stabilityPool.getTotalBoldDeposits();
    assert.isTrue(BoldinSP_B.lt(BoldinSP_A));

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_B = bobColl.sub(_0pt5percent_bobColl);
    const ETHinSP_B = await stabilityPool.getCollBalance();

    const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A);

    assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000);
  });

  // --- Event emission in single liquidation ---

  it("Gas compensation from pool-offset liquidations. Liquidation event emits the correct gas compensation and total liquidated coll and debt", async () => {
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } });

    // A-E open troves
    const { troveId: aliceTroveId, totalDebt: A_totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(100, 18),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId, totalDebt: B_totalDebt } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(200, 18),
      extraParams: { from: bob },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(300, 18),
      extraParams: { from: carol },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: A_totalDebt,
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: B_totalDebt,
      extraParams: { from: erin },
    });

    // D, E each provide Bold to SP
    await th.provideToSPAndClaim(contracts, A_totalDebt, {
      from: dennis,
    });
    await th.provideToSPAndClaim(contracts, B_totalDebt, { from: erin });

    const BoldinSP_0 = await stabilityPool.getTotalBoldDeposits();

    // th.logBN('TCR', await troveManager.getTCR(await priceFeed.getPrice()))
    // --- Price drops to 9.99 ---
    await priceFeed.setPrice("9990000000000000000");
    const price_1 = await priceFeed.getPrice();

    /*
    ETH:USD price = 9.99
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const aliceColl = (await troveManager.Troves(aliceTroveId))[1];
    const aliceDebt = (await troveManager.Troves(aliceTroveId))[0];

    // th.logBN('TCR', await troveManager.getTCR(await priceFeed.getPrice()))
    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(aliceTroveId, {
      from: liquidator,
      gasPrice: GAS_PRICE,
    });

    const expectedGasComp_A = aliceColl.mul(th.toBN(5)).div(th.toBN(1000));
    const expectedLiquidatedColl_A = aliceColl.sub(expectedGasComp_A);
    const expectedLiquidatedDebt_A = aliceDebt;

    const [loggedDebt_A, loggedColl_A, loggedGasComp_A] = th.getEmittedLiquidationValues(liquidationTxA);

    assert.isAtMost(
      th.getDifference(expectedLiquidatedDebt_A, loggedDebt_A),
      1000,
    );
    assert.isAtMost(
      th.getDifference(expectedLiquidatedColl_A, loggedColl_A),
      1000,
    );
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasComp_A), 1000);

    // --- Price drops to 3 ---
    await priceFeed.setPrice(dec(3, 18));
    const price_2 = await priceFeed.getPrice();

    /*
    ETH:USD price = 3
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const bobColl = (await troveManager.Troves(bobTroveId))[1];
    const bobDebt = (await troveManager.Troves(bobTroveId))[0];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxB = await troveManager.liquidate(bobTroveId, {
      from: liquidator,
      gasPrice: GAS_PRICE,
    });

    const expectedGasComp_B = bobColl.mul(th.toBN(5)).div(th.toBN(1000));
    const expectedLiquidatedColl_B = bobColl.sub(expectedGasComp_B);
    const expectedLiquidatedDebt_B = bobDebt;

    const [loggedDebt_B, loggedColl_B, loggedGasComp_B] = th.getEmittedLiquidationValues(liquidationTxB);

    assert.isAtMost(
      th.getDifference(expectedLiquidatedDebt_B, loggedDebt_B),
      1000,
    );
    assert.isAtMost(
      th.getDifference(expectedLiquidatedColl_B, loggedColl_B),
      1000,
    );
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasComp_B), 1000);
  });

  it("gas compensation from pool-offset liquidations. Liquidation event emits the correct gas compensation and total liquidated coll and debt", async () => {
    await priceFeed.setPrice(dec(400, 18));
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } });

    // A-E open troves
    const { troveId: aliceTroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(200, 18),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(120, 16)),
      extraBoldAmount: dec(5000, 18),
      extraParams: { from: bob },
    });
    await openTrove({
      ICR: toBN(dec(60, 18)),
      extraBoldAmount: dec(600, 18),
      extraParams: { from: carol },
    });
    await openTrove({
      ICR: toBN(dec(80, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(80, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: erin },
    });

    // D, E each provide 10000 Bold to SP
    await th.provideToSPAndClaim(contracts, dec(1, 23), { from: dennis });
    await th.provideToSPAndClaim(contracts, dec(1, 23), { from: erin });

    const BoldinSP_0 = await stabilityPool.getTotalBoldDeposits();
    const ETHinSP_0 = await stabilityPool.getCollBalance();

    // --- Price drops to 199.999 ---
    await priceFeed.setPrice("199999000000000000000");
    const price_1 = await priceFeed.getPrice();

    /*
    ETH:USD price = 199.999
    Alice coll = 1 ETH. Value: $199.999
    0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
    Minimum comp = $10 = 0.05000025000125001 ETH.
    -> Expect 0.05000025000125001 ETH sent to liquidator,
    and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const aliceColl = (await troveManager.Troves(aliceTroveId))[1];
    const aliceDebt = (await troveManager.Troves(aliceTroveId))[0];
    const aliceCollValueInUSD = aliceColl.mul(price_1).div(ONE);
    assert.isTrue(aliceCollValueInUSD.gt(th.toBN(dec(10, 18))));

    // Check value of 0.5% of collateral in USD is < $10
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN("200"));

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const aliceICR = await troveManager.getCurrentICR(aliceTroveId, price_1);
    assert.isTrue(aliceICR.lt(mv._MCR));

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(aliceTroveId, {
      from: liquidator,
      gasPrice: GAS_PRICE,
    });

    const expectedGasComp_A = _0pt5percent_aliceColl;
    const expectedLiquidatedColl_A = aliceColl.sub(expectedGasComp_A);
    const expectedLiquidatedDebt_A = aliceDebt;

    const [loggedDebt_A, loggedColl_A, loggedGasComp_A] = th.getEmittedLiquidationValues(liquidationTxA);

    assert.isAtMost(
      th.getDifference(expectedLiquidatedDebt_A, loggedDebt_A),
      1000,
    );
    assert.isAtMost(
      th.getDifference(expectedLiquidatedColl_A, loggedColl_A),
      1000,
    );
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasComp_A), 1000);

    // --- Price drops to 15 ---
    await priceFeed.setPrice(dec(15, 18));
    const price_2 = await priceFeed.getPrice();

    /*
    ETH:USD price = 15
    Bob coll = 15 ETH. Value: $165
    0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
    Minimum comp = $10 =  0.66666...ETH.
    -> Expect 0.666666666666666666 ETH sent to liquidator,
    and (15 - 0.666666666666666666) ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const bobColl = (await troveManager.Troves(bobTroveId))[1];
    const bobDebt = (await troveManager.Troves(bobTroveId))[0];

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const bobICR = await troveManager.getCurrentICR(bobTroveId, price_2);
    assert.isTrue(bobICR.lte(mv._MCR));

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives
    const liquidationTxB = await troveManager.liquidate(bobTroveId, {
      from: liquidator,
      gasPrice: GAS_PRICE,
    });

    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN("200"));
    const expectedGasComp_B = _0pt5percent_bobColl;
    const expectedLiquidatedColl_B = bobColl.sub(expectedGasComp_B);
    const expectedLiquidatedDebt_B = bobDebt;

    const [loggedDebt_B, loggedColl_B, loggedGasComp_B] = th.getEmittedLiquidationValues(liquidationTxB);

    assert.isAtMost(
      th.getDifference(expectedLiquidatedDebt_B, loggedDebt_B),
      1000,
    );
    assert.isAtMost(
      th.getDifference(expectedLiquidatedColl_B, loggedColl_B),
      1000,
    );
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasComp_B), 1000);
  });

  it("gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt", async () => {
    // open troves
    await priceFeed.setPrice(dec(400, 18));
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } });

    // A-E open troves
    const { troveId: aliceTroveId } = await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(2000, 18),
      extraParams: { from: alice },
    });
    const { troveId: bobTroveId } = await openTrove({
      ICR: toBN(dec(1875, 15)),
      extraBoldAmount: dec(8000, 18),
      extraParams: { from: bob },
    });
    await openTrove({
      ICR: toBN(dec(2, 18)),
      extraBoldAmount: dec(600, 18),
      extraParams: { from: carol },
    });
    await openTrove({
      ICR: toBN(dec(4, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: dennis },
    });
    await openTrove({
      ICR: toBN(dec(4, 18)),
      extraBoldAmount: dec(1, 23),
      extraParams: { from: erin },
    });

    // D, E each provide 10000 Bold to SP
    await th.provideToSPAndClaim(contracts, dec(1, 23), { from: dennis });
    await th.provideToSPAndClaim(contracts, dec(1, 23), { from: erin });

    const BoldinSP_0 = await stabilityPool.getTotalBoldDeposits();
    const ETHinSP_0 = await stabilityPool.getCollBalance();

    await priceFeed.setPrice(dec(200, 18));
    const price_1 = await priceFeed.getPrice();

    // Check value of 0.5% of collateral in USD is > $10
    const aliceColl = (await troveManager.Troves(aliceTroveId))[1];
    const aliceDebt = (await troveManager.Troves(aliceTroveId))[0];
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN("200"));

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const aliceICR = await troveManager.getCurrentICR(aliceTroveId, price_1);
    assert.isTrue(aliceICR.lt(mv._MCR));

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(aliceTroveId, {
      from: liquidator,
      gasPrice: GAS_PRICE,
    });

    const expectedGasComp_A = _0pt5percent_aliceColl;
    const expectedLiquidatedColl_A = aliceColl.sub(_0pt5percent_aliceColl);
    const expectedLiquidatedDebt_A = aliceDebt;

    const [loggedDebt_A, loggedColl_A, loggedGasComp_A] = th.getEmittedLiquidationValues(liquidationTxA);

    assert.isAtMost(
      th.getDifference(expectedLiquidatedDebt_A, loggedDebt_A),
      1000,
    );
    assert.isAtMost(
      th.getDifference(expectedLiquidatedColl_A, loggedColl_A),
      1000,
    );
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasComp_A), 1000);

    /*
   ETH:USD price = 200
   Bob coll = 37.5 ETH. Value: $7500
   0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
   Minimum comp = $10 = 0.05 ETH.
   -> Expect 0.1875 ETH sent to liquidator,
   and (37.5 - 0.1875 ETH) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const bobColl = (await troveManager.Troves(bobTroveId))[1];
    const bobDebt = (await troveManager.Troves(bobTroveId))[0];
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN("200"));

    assert.isFalse(await th.checkBelowCriticalThreshold(contracts));

    const bobICR = await troveManager.getCurrentICR(bobTroveId, price_1);
    assert.isTrue(bobICR.lt(mv._MCR));

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxB = await troveManager.liquidate(bobTroveId, {
      from: liquidator,
      gasPrice: GAS_PRICE,
    });

    const expectedGasComp_B = _0pt5percent_bobColl;
    const expectedLiquidatedColl_B = bobColl.sub(_0pt5percent_bobColl);
    const expectedLiquidatedDebt_B = bobDebt;

    const [loggedDebt_B, loggedColl_B, loggedGasComp_B] = th.getEmittedLiquidationValues(liquidationTxB);

    assert.isAtMost(
      th.getDifference(expectedLiquidatedDebt_B, loggedDebt_B),
      1000,
    );
    assert.isAtMost(
      th.getDifference(expectedLiquidatedColl_B, loggedColl_B),
      1000,
    );
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasComp_B), 1000);
  });

  // --- Trove ordering by ICR tests ---

  it("Trove ordering: same collateral, decreasing debt. Price successively increases. Troves should maintain ordering by ICR", async () => {
    const _10_accounts = accounts.slice(1, 11);

    let debt = 50;
    // create 10 troves, constant coll, descending debt 100 to 90 Bold
    for (const account of _10_accounts) {
      const debtString = debt.toString().concat("000000000000000000");
      await openTrove({
        extraBoldAmount: debtString,
        extraParams: { from: account, value: dec(30, "ether") },
      });

      const squeezedTroveAddr = th.squeezeAddr(account);

      debt -= 1;
    }

    const initialPrice = await priceFeed.getPrice();
    const firstColl = (await troveManager.Troves(_10_accounts[0]))[1];

    // Vary price 200-210
    let price = 200;
    while (price < 210) {
      const priceString = price.toString().concat("000000000000000000");
      await priceFeed.setPrice(priceString);

      const ICRList = [];
      const coll_firstTrove = (await troveManager.Troves(_10_accounts[0]))[1];
      const gasComp_firstTrove = (
        await troveManager.getCollGasCompensation(coll_firstTrove)
      ).toString();

      for (account of _10_accounts) {
        // Check gas compensation is the same for all troves
        const coll = (await troveManager.Troves(account))[1];
        const gasCompensation = (
          await troveManager.getCollGasCompensation(coll)
        ).toString();

        assert.equal(gasCompensation, gasComp_firstTrove);

        const ICR = await troveManager.getCurrentICR(account, price);
        ICRList.push(ICR);

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2];

          try {
            assert.isTrue(ICR.gte(prevICR));
          } catch (error) {
            console.log(`ETH price at which trove ordering breaks: ${price}`);
            logICRs(ICRList);
          }
        }

        price += 1;
      }
    }
  });

  it("Trove ordering: increasing collateral, constant debt. Price successively increases. Troves should maintain ordering by ICR", async () => {
    const _20_accounts = accounts.slice(1, 21);

    let coll = 50;
    // create 20 troves, increasing collateral, constant debt = 100Bold
    for (const account of _20_accounts) {
      const collString = coll.toString().concat("000000000000000000");
      await contracts.WETH.mint(account, web3.utils.toBN(collString).add(ETH_GAS_COMPENSATION));
      await openTrove({
        extraBoldAmount: dec(100, 18),
        extraParams: { from: account, value: collString },
      });

      coll += 5;
    }

    const initialPrice = await priceFeed.getPrice();

    // Vary price
    let price = 1;
    while (price < 300) {
      const priceString = price.toString().concat("000000000000000000");
      await priceFeed.setPrice(priceString);

      const ICRList = [];

      for (account of _20_accounts) {
        const ICR = await troveManager.getCurrentICR(account, price);
        ICRList.push(ICR);

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2];

          try {
            assert.isTrue(ICR.gte(prevICR));
          } catch (error) {
            console.log(`ETH price at which trove ordering breaks: ${price}`);
            logICRs(ICRList);
          }
        }

        price += 10;
      }
    }
  });

  it("Trove ordering: Constant raw collateral ratio (excluding virtual debt). Price successively increases. Troves should maintain ordering by ICR", async () => {
    let collVals = [
      1,
      5,
      10,
      25,
      50,
      100,
      500,
      1000,
      5000,
      10000,
      50000,
      100000,
      500000,
      1000000,
      5000000,
    ].map((v) => v * 20);
    const accountsList = accounts.slice(1, collVals.length + 1);

    let accountIdx = 0;
    for (const coll of collVals) {
      const debt = coll * 110;

      const account = accountsList[accountIdx];
      const collString = coll.toString().concat("000000000000000000");
      await openTrove({
        extraBoldAmount: dec(100, 18),
        extraParams: { from: account, value: collString },
      });

      accountIdx += 1;
    }

    const initialPrice = await priceFeed.getPrice();

    // Vary price
    let price = 1;
    while (price < 300) {
      const priceString = price.toString().concat("000000000000000000");
      await priceFeed.setPrice(priceString);

      const ICRList = [];

      for (account of accountsList) {
        const ICR = await troveManager.getCurrentICR(account, price);
        ICRList.push(ICR);

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2];

          try {
            assert.isTrue(ICR.gte(prevICR));
          } catch (error) {
            console.log(error);
            console.log(`ETH price at which trove ordering breaks: ${price}`);
            logICRs(ICRList);
          }
        }

        price += 10;
      }
    }
  });
});
