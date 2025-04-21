const testHelpers = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol");

const { dec, toBN } = testHelpers.TestHelper;
const th = testHelpers.TestHelper;

contract("StabilityPool - Withdrawal of stability deposit - Reward calculations", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 22);

  const [
    owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    defaulter_6,
    whale,
    // whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet,
    A,
    B,
    C,
    D,
    E,
    F,
  ] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;

  let priceFeed;
  let boldToken;
  let troveManager;
  let stabilityPool;

  const ZERO_ADDRESS = th.ZERO_ADDRESS;

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    mocks: { TroveManager: TroveManagerTester },
  });

  const getETHGainWithdrawn = (tx) =>
    th.toBN(
      "0x"
        + th.getEventBySignature(
          tx,
          "DepositOperation(address,uint8,uint256,int256,uint256,uint256,uint256,uint256)",
        ).data.replace(/^0x/, "").match(/.{64}/g)[6],
    );

  describe("Stability Pool Withdrawal", async () => {
    beforeEach(async () => {
      const result = await deployFixture();
      contracts = result.contracts;
      priceFeed = contracts.priceFeedTestnet;
      boldToken = contracts.boldToken;
      troveManager = contracts.troveManager;
      stabilityPool = contracts.stabilityPool;
    });

    // --- Compounding tests ---

    // --- withdrawFromSP()

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (const account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter opens trove with 200% ICR and 10k Bold net debt
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      // Check depositors' compounded deposit is 6666.66 Bold and ETH Gain is 33.16 ETH
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "6666666666666666666666"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "6666666666666666666666"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "6666666666666666666666"), 10000);

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "33166666666666666667"), 10000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "33166666666666666667"), 10000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "33166666666666666667"), 10000);
    });

    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (const account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Check depositors' compounded deposit is 3333.33 Bold and ETH Gain is 66.33 ETH
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "3333333333333333333333"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "3333333333333333333333"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "3333333333333333333333"), 10000);

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "66333333333333333333"), 10000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "66333333333333333333"), 10000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "66333333333333333333"), 10000);
    });

    it("withdrawFromSP():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Check depositors' compounded deposit is 0 Bold and ETH Gain is 99.5 ETH
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "0"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "0"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "0"), 10000);

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(99500, 15)), 10000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(99500, 15)), 10000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(99500, 15)), 10000);
    });

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing Bold", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: "50000000000000000000" },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(7000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: "70000000000000000000" },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Check depositors' compounded deposit
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "6000000000000000000000"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "6000000000000000000000"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "6000000000000000000000"), 10000);

      // (0.5 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(398, 17)), 10000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(398, 17)), 10000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(398, 17)), 10000);
    });

    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing Bold", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: "50000000000000000000" },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(6000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: "60000000000000000000" },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(7000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: "70000000000000000000" },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Check depositors' compounded deposit
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "4000000000000000000000"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "4000000000000000000000"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "4000000000000000000000"), 10000);

      // (0.5 + 0.6 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(597, 17)), 10000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(597, 17)), 10000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(597, 17)), 10000);
    });

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k, 20k, 30k Bold to A, B and C respectively who then deposit it to the SP
      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });
      await boldToken.transfer(bob, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: bob });
      await boldToken.transfer(carol, dec(30000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), { from: carol });

      // 2 Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(20000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(alice)).toString(), "6666666666666666666666"),
        100000,
      );
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "13333333333333333333333"), 100000);
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "20000000000000000000000"),
        100000,
      );

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "33166666666666666667"), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "66333333333333333333"), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000);
    });

    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k, 20k, 30k Bold to A, B and C respectively who then deposit it to the SP
      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });
      await boldToken.transfer(bob, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: bob });
      await boldToken.transfer(carol, dec(30000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), { from: carol });

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(20000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(alice)).toString(), "5000000000000000000000"),
        100000,
      );
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "10000000000000000000000"), 100000);
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "15000000000000000000000"),
        100000,
      );

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "49750000000000000000"), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "149250000000000000000"), 100000);
    });

    // --- Varied deposits and varied liquidation amount ---
    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens Trove with 1m ETH
      await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(1000000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(1000000, "ether") },
      );

      /* Depositors provide:-
         Alice:  2000 Bold
         Bob:  456000 Bold
         Carol: 13100 Bold */
      // Whale transfers Bold to  A, B and C respectively who then deposit it to the SP
      await boldToken.transfer(alice, dec(2000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(2000, 18), { from: alice });
      await boldToken.transfer(bob, dec(456000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(456000, 18), { from: bob });
      await boldToken.transfer(carol, dec(13100, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(13100, 18), { from: carol });

      /* Defaulters open troves

         Defaulter 1: 207000 Bold & 2160 ETH
         Defaulter 2: 5000 Bold & 50 ETH
         Defaulter 3: 46700 Bold & 500 ETH
      */
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("207000000000000000000000"),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(2160, 18) },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5, 21)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(50, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("46700000000000000000000"),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(500, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(500000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(500000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(500000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      // ()
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(alice)).toString(), "901719380174061000000"),
        100000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(bob)).toString(), "205592018679686000000000"),
        10000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "5906261940140100000000"),
        10000000000,
      );

      // 2710 * 0.995 * {2000, 456000, 13100}/4711
      // EDIT: gas comp capped at 2: (50 * 0.995 + 2660 - 4) * {2000, 456000, 13100}/4711
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "11486945446800000000"), 10000000000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "2619023561880000000000"), 10000000000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "75239492676700000000"), 10000000000);
    });

    // --- Deposit enters at t > 0

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 Bold.  A, B, C, D withdraw correct Bold deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Whale transfers 10k to Dennis who then provides to SP
      await boldToken.transfer(dennis, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: dennis });

      // Third defaulter liquidated
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(alice)).toString(), "1666666666666666666666"),
        100000,
      );
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "1666666666666666666666"), 100000);
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "1666666666666666666666"),
        100000,
      );

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "5000000000000000000000"),
        100000,
      );

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "82916666666666666667"), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "82916666666666666667"), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "82916666666666666667"), 100000);

      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "49750000000000000000"), 100000);
    });

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 Bold.  A, B, C, D withdraw correct Bold deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Dennis opens a trove and provides to SP
      await boldToken.transfer(dennis, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: dennis });

      // Third and fourth defaulters liquidated
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(dennis)).toString(), "0"), 100000);

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 17)), 100000);
    });

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct Bold deposit and ETH Gain", async () => {
      // Whale opens Trove with 1m ETH
      await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(1000000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(1000000, "ether") },
      );

      /* Depositors open troves and make SP deposit:
         Alice: 60000 Bold
         Bob: 20000 Bold
         Carol: 15000 Bold
      */
      // Whale transfers Bold to  A, B and C respectively who then deposit it to the SP
      await boldToken.transfer(alice, dec(60000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(60000, 18), { from: alice });
      await boldToken.transfer(bob, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: bob });
      await boldToken.transfer(carol, dec(15000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(15000, 18), { from: carol });

      /* Defaulters open troves:
         Defaulter 1:  10000 Bold, 100 ETH
         Defaulter 2:  25000 Bold, 250 ETH
         Defaulter 3:  5000 Bold, 50 ETH
         Defaulter 4:  40000 Bold, 400 ETH
      */
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(25000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: "250000000000000000000" },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: "50000000000000000000" },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(40000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(400, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Dennis provides 25000 Bold
      await boldToken.transfer(dennis, dec(25000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(25000, 18), { from: dennis });

      // Last two defaulters liquidated
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: dennis });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(alice)).toString(), "17832817337461300000000"),
        100000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(bob)).toString(), "5944272445820430000000"),
        100000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "4458204334365320000000"),
        100000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "11764705882352900000000"),
        100000000000,
      );

      // 3.5*0.995 * {60000,20000,15000,0} / 95000 + 450*0.995 * {60000/950*{60000,20000,15000},25000} / (120000-35000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "419563467492260055900"), 100000000000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "139854489164086692700"), 100000000000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "104890866873065014000"), 100000000000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "131691176470588233700"), 100000000000);
    });

    // --- Depositor leaves ---

    it("withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 Bold.  A, B, C, D withdraw correct Bold deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol, dennis];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });
      await priceFeed.setPrice(dec(100, 18));

      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "5000000000000000000000"),
        100000,
      );
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "49750000000000000000"), 100000);

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "0"), 1000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "0"), 1000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "0"), 1000);

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000);
    });

    it("withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct Bold deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      /* Initial deposits:
         Alice: 20000 Bold
         Bob: 25000 Bold
         Carol: 12500 Bold
         Dennis: 40000 Bold
      */
      // Whale transfers Bold to  A, B,C and D respectively who then deposit it to the SP
      await boldToken.transfer(alice, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: alice });
      await boldToken.transfer(bob, dec(25000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(25000, 18), { from: bob });
      await boldToken.transfer(carol, dec(12500, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(12500, 18), { from: carol });
      await boldToken.transfer(dennis, dec(40000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(40000, 18), { from: dennis });

      /* Defaulters open troves:
         Defaulter 1: 10000 Bold
         Defaulter 2: 20000 Bold
         Defaulter 3: 30000 Bold
         Defaulter 4: 5000 Bold
      */
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(200, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(30000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(300, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: "50000000000000000000" },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(40000, 18), { from: dennis });
      await priceFeed.setPrice(dec(100, 18));

      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "27692307692307700000000"),
        100000000000,
      );
      // 300*0.995 * 40000/97500
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "122461538461538466100"), 100000000000);

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(100000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(alice)).toString(), "1672240802675590000000"),
        10000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(bob)).toString(), "2090301003344480000000"),
        100000000000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "1045150501672240000000"),
        100000000000,
      );

      // 300*0.995 * {20000,25000,12500}/97500 + 350*0.995 * {20000,25000,12500}/57500
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "182361204013377919900"), 100000000000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "227951505016722411000"), 100000000000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "113975752508361205500"), 100000000000);
    });

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawFromSP(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 Bold. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct Bold deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B and D who then deposit it to the SP
      const depositors = [alice, bob, dennis];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulters open troves
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: "50000000000000000000" },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Carol makes deposit
      await boldToken.transfer(carol, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: carol });

      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });
      await priceFeed.setPrice(dec(100, 18));

      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "1666666666666666666666"),
        100000,
      );
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "82916666666666666667"), 100000);

      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "666666666666666666666"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "666666666666666666666"), 100000);
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "2000000000000000000000"),
        100000,
      );

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, "92866666666666666667"), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "92866666666666666667"), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "79600000000000000000"), 100000);
    });

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D deposit 10000
    // L2 cancels 10000,100

    // A, B withdraw 0Bold & 100e
    // C, D withdraw 5000Bold  & 500e
    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B who then deposit it to the SP
      const depositors = [alice, bob];
      for (const account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // 2 Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(200, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 Bold fully offset with pool.
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      // Carol, Dennis each deposit 10000 Bold
      const depositors_2 = [carol, dennis];
      for (const account of depositors_2) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter 2 liquidated. 10000 Bold offset
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // await th.openTroveWrapper(contracts, dec(1, 18), account, account, { from: erin, value: dec(2, 'ether') })
      // await th.provideToSPAndClaim(contracts, dec(1, 18), { from: erin })

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });

      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();

      // Expect Alice And Bob's compounded deposit to be 0 Bold
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "0"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "0"), 10000);

      // Expect Alice and Bob's ETH Gain to be 100 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000);

      // Expect Carol And Dennis' compounded deposit to be 50 Bold
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "5000000000000000000000"),
        100000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "5000000000000000000000"),
        100000,
      );

      // Expect Carol and and Dennis ETH Gain to be 50 ETH
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "49750000000000000000"), 100000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "49750000000000000000"), 100000);
    });

    // A, B deposit 10000
    // L1 cancels 10000, 1
    // L2 10000, 200 empties Pool
    // C, D deposit 10000
    // L3 cancels 10000, 1
    // L2 20000, 200 empties Pool
    it("withdrawFromSP(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B who then deposit it to the SP
      const depositors = [alice, bob];
      for (const account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // 4 Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      const epoch_0 = (await stabilityPool.currentEpoch()).toString();
      const scale_0 = (await stabilityPool.currentScale()).toString();
      const P_0 = (await stabilityPool.P()).toString();

      assert.equal(epoch_0, "0");
      assert.equal(scale_0, "0");
      assert.equal(P_0, dec(1, 18));

      // Defaulter 1 liquidated. 10--0 Bold fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      // Check epoch, scale and sum
      const epoch_1 = (await stabilityPool.currentEpoch()).toString();
      const scale_1 = (await stabilityPool.currentScale()).toString();
      const P_1 = (await stabilityPool.P()).toString();

      assert.equal(epoch_1, "0");
      assert.equal(scale_1, "0");
      assert.isAtMost(th.getDifference(P_1, dec(5, 17)), 1000);

      // Defaulter 2 liquidated. 1--00 Bold, empties pool
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Check epoch, scale and sum
      const epoch_2 = (await stabilityPool.currentEpoch()).toString();
      const scale_2 = (await stabilityPool.currentScale()).toString();
      const P_2 = (await stabilityPool.P()).toString();

      assert.equal(epoch_2, "1");
      assert.equal(scale_2, "0");
      assert.equal(P_2, dec(1, 18));

      // Carol, Dennis each deposit 10000 Bold
      const depositors_2 = [carol, dennis];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter 3 liquidated. 10000 Bold fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Check epoch, scale and sum
      const epoch_3 = (await stabilityPool.currentEpoch()).toString();
      const scale_3 = (await stabilityPool.currentScale()).toString();
      const P_3 = (await stabilityPool.P()).toString();

      assert.equal(epoch_3, "1");
      assert.equal(scale_3, "0");
      assert.isAtMost(th.getDifference(P_3, dec(5, 17)), 1000);

      // Defaulter 4 liquidated. 10000 Bold, empties pool
      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      // Check epoch, scale and sum
      const epoch_4 = (await stabilityPool.currentEpoch()).toString();
      const scale_4 = (await stabilityPool.currentScale()).toString();
      const P_4 = (await stabilityPool.P()).toString();

      assert.equal(epoch_4, "2");
      assert.equal(scale_4, "0");
      assert.equal(P_4, dec(1, 18));
    });

    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D, E deposit 10000, 20000, 30000
    // L2 cancels 10000,100

    // A, B withdraw 0 Bold & 100e
    // C, D withdraw 5000 Bold  & 50e
    it("withdrawFromSP(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Whale transfers 10k Bold to A, B who then deposit it to the SP
      const depositors = [alice, bob];
      for (account of depositors) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // 2 Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(200, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 Bold fully offset with pool.
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      // Carol, Dennis, Erin each deposit 10000, 20000, 30000 Bold respectively
      await boldToken.transfer(carol, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: carol });

      await boldToken.transfer(dennis, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: dennis });

      await boldToken.transfer(erin, dec(30000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), { from: erin });

      // Defaulter 2 liquidated. 10000 Bold offset
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(20000, 18), { from: dennis });
      const txE = await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: erin });

      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();
      const erin_ETHWithdrawn = getETHGainWithdrawn(txE).toString();

      // Expect Alice And Bob's compounded deposit to be 0 Bold
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "0"), 10000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "0"), 10000);

      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(carol)).toString(), "8333333333333333333333"),
        100000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(dennis)).toString(), "16666666666666666666666"),
        100000,
      );
      assert.isAtMost(
        th.getDifference((await boldToken.balanceOf(erin)).toString(), "25000000000000000000000"),
        100000,
      );

      // Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000);

      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "16583333333333333333"), 100000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "33166666666666666667"), 100000);
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, "49750000000000000000"), 100000);
    });

    // A deposits 10000
    // L1, L2, L3 liquidated with 10000 Bold each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawFromSP(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1,2,3 withdraw 10000 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(10000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1, 2  and 3 liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();

      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), 0), 100000);
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000);
    });

    // --- Serial full offsets ---

    // A,B deposit 10000 Bold
    // L1 cancels 20000 Bold, 2E
    // B,C deposits 10000 Bold
    // L2 cancels 20000 Bold, 2E
    // E,F deposit 10000 Bold
    // L3 cancels 20000, 200E
    // G,H deposits 10000
    // L4 cancels 20000, 200E

    // Expect all depositors withdraw 0 Bold and 100 ETH

    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // 4 Defaulters open trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(200, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(200, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(200, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(20000, 18)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(200, "ether") },
      );

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Alice, Bob each deposit 10k Bold
      const depositors_1 = [alice, bob];
      for (account of depositors_1) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter 1 liquidated. 20k Bold fully offset with pool.
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      // Carol, Dennis each deposit 10000 Bold
      const depositors_2 = [carol, dennis];
      for (account of depositors_2) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter 2 liquidated. 10000 Bold offset
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      // Erin, Flyn each deposit 10000 Bold
      const depositors_3 = [erin, flyn];
      for (account of depositors_3) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter 3 liquidated. 10000 Bold offset
      await troveManager.liquidate(defaulter_3_TroveId, { from: owner });

      // Graham, Harriet each deposit 10000 Bold
      const depositors_4 = [graham, harriet];
      for (account of depositors_4) {
        await boldToken.transfer(account, dec(10000, 18), { from: whale });
        await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: account });
      }

      // Defaulter 4 liquidated. 10k Bold offset
      await troveManager.liquidate(defaulter_4_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });
      const txE = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: erin });
      const txF = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: flyn });
      const txG = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: graham });
      const txH = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: harriet });

      const alice_ETHWithdrawn = getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = getETHGainWithdrawn(txD).toString();
      const erin_ETHWithdrawn = getETHGainWithdrawn(txE).toString();
      const flyn_ETHWithdrawn = getETHGainWithdrawn(txF).toString();
      const graham_ETHWithdrawn = getETHGainWithdrawn(txG).toString();
      const harriet_ETHWithdrawn = getETHGainWithdrawn(txH).toString();

      // Expect all deposits to be 0 Bold
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(alice)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(dennis)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(erin)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(flyn)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(graham)).toString(), "0"), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(harriet)).toString(), "0"), 100000);

      /* Expect all ETH gains to be 100 ETH:  Since each liquidation of empties the pool, depositors
         should only earn ETH from the single liquidation that cancelled with their deposit */
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(flyn_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(graham_ETHWithdrawn, dec(995, 17)), 100000);
      assert.isAtMost(th.getDifference(harriet_ETHWithdrawn, dec(995, 17)), 100000);

      const finalEpoch = (await stabilityPool.currentEpoch()).toString();
      assert.equal(finalEpoch, 4);
    });

    // --- Scale factor tests ---

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991
    // A withdraws all
    // B deposits 10000
    // L2 of 9900 Bold, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct ETH gain, i.e. all of the reward
    //
    // TODO: Changes since v1 have introduced very slight precision error in this test. Potentially due to slightly different rounding
    // in helper functon getOpenTroveBoldAmount due to now-zero borrow fees. Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 withdraws 'almost' 10000 Bold:  9999.99991 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999999910000000000000"),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );

      assert.equal(await stabilityPool.currentScale(), "0");

      // Defaulter 2 withdraws 9900 Bold
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(9900, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(60, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9e9.
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      // it gives 8999999999, due to this line in StabilityPool._computeETHRewardsPerUnitStaked function
      // boldLossPerUnitStaked = boldLossNumerator / _totalBoldDeposits + 1;
      th.assertIsApproximatelyEqual((await stabilityPool.P()).toString(), dec(9, 9), 1);

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      await priceFeed.setPrice(dec(100, 18));

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await getETHGainWithdrawn(txA).toString();

      await boldToken.transfer(bob, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: bob });

      // Defaulter 2 liquidated.  9900 Bold liquidated. P altered by a factor of 1-(9900/10000) = 0.01.  Scale changed.
      await troveManager.liquidate(defaulter_2_TroveId, { from: owner });

      assert.equal(await stabilityPool.currentScale(), "1");

      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const bob_ETHWithdrawn = await getETHGainWithdrawn(txB).toString();

      // Expect Bob to withdraw 1% of initial deposit (100 Bold) and all the liquidated ETH (60 ether)
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), "100000000000000000000"), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "59700000000000000000"), 100000);
    });

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991 Bold
    // A withdraws all
    // B, C, D deposit 10000, 20000, 30000
    // L2 of 59400, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct ETH gain, i.e. all of the reward
    //
    // TODO: Changes since v1 have introduced very slight precision error in this test. Potentially due to slightly different rounding
    // in helper functon getOpenTroveBoldAmount due to now-zero borrow fees. Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 withdraws 'almost' 10k Bold.
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999999910000000000000"),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );

      // Defaulter 2 withdraws 59400 Bold
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("59400000000000000000000"),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(330, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9e9
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      th.assertIsApproximatelyEqual((await stabilityPool.P()).toString(), dec(9, 9), 1);

      assert.equal(await stabilityPool.currentScale(), "0");

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      await priceFeed.setPrice(dec(100, 18));

      // B, C, D deposit to Stability Pool
      await boldToken.transfer(bob, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: bob });

      await boldToken.transfer(carol, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: carol });

      await boldToken.transfer(dennis, dec(30000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), { from: dennis });

      // 54000 Bold liquidated.  P altered by a factor of 1-(59400/60000) = 0.01. Scale changed.
      const txL2 = await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isTrue(txL2.receipt.status);

      assert.equal(await stabilityPool.currentScale(), "1");

      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(20000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: dennis });

      /* Expect depositors to withdraw 1% of their initial deposit, and an ETH gain
         in proportion to their initial deposit:

         Bob:  1000 Bold, 55 Ether
         Carol:  2000 Bold, 110 Ether
         Dennis:  3000 Bold, 165 Ether

         Total: 6000 Bold, 300 Ether
      */
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), dec(100, 18)), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), dec(200, 18)), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(dennis)).toString(), dec(300, 18)), 100000);

      const bob_ETHWithdrawn = await getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = await getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = await getETHGainWithdrawn(txD).toString();

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, "54725000000000000000"), 100000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, "109450000000000000000"), 100000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, "164175000000000000000"), 100000);
    });
    // Deposit's ETH reward spans one scale change - deposit reduced by correct amount

    // A make deposit 10000 Bold
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 Bold
    // A withdraws
    // B makes deposit 10000 Bold
    // L2 decreases P again by 1e-5, over the scale boundary: 9999.9000000000000000 (near to the 10000 Bold total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire ETH gain from L2
    //
    // TODO: Changes since v1 have introduced very slight precision error in this test. Potentially due to slightly different rounding
    // in helper functon getOpenTroveBoldAmount due to now-zero borrow fees. Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 and default 2 each withdraw 9999.999999999 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 1e13
      const txL1 = await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      assert.isTrue(txL1.receipt.status);
      th.logBN("P", await stabilityPool.P()); //  0.000009999999999999, so 1 wei less than expected
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 13))); // P decreases. Expect P = 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), "0");

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      await priceFeed.setPrice(dec(100, 18));

      // Bob deposits 10k Bold
      await boldToken.transfer(bob, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: bob });

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isTrue(txL2.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 17)), 1); // Scale changes and P changes. P = 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), "1");

      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const bob_ETHWithdrawn = await getETHGainWithdrawn(txB).toString();

      // Bob should withdraw 1e-5 of initial deposit: 0.1 Bold and the full ETH gain of 100 ether
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), dec(1, 17)), 100000);
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000000000);
    });

    // A make deposit 10000 Bold
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 Bold
    // A withdraws
    // B,C D make deposit 10000, 20000, 30000
    // L2 decreases P again by 1e-5, over boundary. L2: 59999.4000000000000000  (near to the 60000 Bold total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire ETH gain from L2
    //
    // TODO: Changes since v1 have introduced very slight precision error in this test. Potentially due to slightly different rounding
    // in helper functon getOpenTroveBoldAmount due to now-zero borrow fees. Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 and default 2 withdraw up to debt of 9999.9 Bold and 59999.4 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999900000000000000000"),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("59999400000000000000000"),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(600, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to 1e13
      const txL1 = await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      th.logBN("P", await stabilityPool.P()); // P = 0.000009999999999999, i.e. 1 wei less than expected
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 13))); // P decreases. Expect P = 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), "0");

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(100, 18), { from: alice });
      await priceFeed.setPrice(dec(100, 18));

      // B, C, D deposit 10000, 20000, 30000 Bold
      await boldToken.transfer(bob, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: bob });

      await boldToken.transfer(carol, dec(20000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(20000, 18), { from: carol });

      await boldToken.transfer(dennis, dec(30000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(30000, 18), { from: dennis });

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isTrue(txL2.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 17)), 10000); // P decreases. P = 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), "1");

      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const bob_ETHWithdrawn = await getETHGainWithdrawn(txB).toString();

      const txC = await th.withdrawFromSPAndClaim(contracts, dec(20000, 18), { from: carol });
      const carol_ETHWithdrawn = await getETHGainWithdrawn(txC).toString();

      const txD = await th.withdrawFromSPAndClaim(contracts, dec(30000, 18), { from: dennis });
      const dennis_ETHWithdrawn = await getETHGainWithdrawn(txD).toString();

      // {B, C, D} should have a compounded deposit of {0.1, 0.2, 0.3} Bold
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(bob)).toString(), dec(1, 17)), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(carol)).toString(), dec(2, 17)), 100000);
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(dennis)).toString(), dec(3, 17)), 100000);

      // deposit / 100 (price) - share of 2 ETH (capped) gas compensation
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(9966666667, 10)), 10000000000);
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(19933333333, 10)), 100000000000);
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(299, 18)), 100000000000);
    });

    // A make deposit 10000 Bold
    // L1 brings P to (~1e-10)*P. L1: 9999.9999999000000000 Bold
    // Expect A to withdraw 0 deposit
    it("withdrawFromSP(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Defaulters 1 withdraws 9999.9999999 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999999999900000000000"),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );

      // Price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 liquidated. P -> (~1e-10)*P
      const txL1 = await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      assert.isTrue(txL1.receipt.status);

      const aliceDeposit = (await stabilityPool.getCompoundedBoldDeposit(alice)).toString();
      // console.log(`alice deposit: ${aliceDeposit}`)
      assert.equal(aliceDeposit, 0);
    });

    // --- Serial scale changes ---

    /* A make deposit 10000 Bold
       L1 brings P to 0.0001P. L1:  9999.900000000000000000 Bold, 1 ETH
       B makes deposit 9999.9, brings SP to 10k
       L2 decreases P by(~1e-5)P. L2:  9999.900000000000000000 Bold, 1 ETH
       C makes deposit 9999.9, brings SP to 10k
       L3 decreases P by(~1e-5)P. L3:  9999.900000000000000000 Bold, 1 ETH
       D makes deposit 9999.9, brings SP to 10k
       L4 decreases P by(~1e-5)P. L4:  9999.900000000000000000 Bold, 1 ETH
       expect A, B, C, D each withdraw ~100 Ether
    */
    // TODO: Changes since v1 have introduced very slight precision error in this test. Potentially due to slightly different rounding
    // in helper functon getOpenTroveBoldAmount due to now-zero borrow fees. Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): Several deposits of 10000 Bold span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Defaulters 1-4 each withdraw 9999.9 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999900000000000000000"),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999900000000000000000"),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999900000000000000000"),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount("9999900000000000000000"),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(100, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 liquidated.  P updated to 1e13
      const txL1 = await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      assert.isTrue(txL1.receipt.status);
      th.logBN("P", await stabilityPool.P()); // P  0.000009999999999999, 1 wei less than expecteed
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 13))); // Expect P decreases to 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), "0");

      // B deposits 9999.9 Bold
      await boldToken.transfer(bob, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: bob });

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isTrue(txL2.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 17)), 10000); // Scale changes and P changes to 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), "1");

      // C deposits 9999.9 Bold
      await boldToken.transfer(carol, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: carol });

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      assert.isTrue(txL3.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 12), 1); // P decreases to 1e(17-5) = 1e12
      assert.equal(await stabilityPool.currentScale(), "1");

      // D deposits 9999.9 Bold
      await boldToken.transfer(dennis, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: dennis });

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4_TroveId, { from: owner });
      assert.isTrue(txL4.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 16), 10000); // Scale changes and P changes to 1e(12-5+9) = 1e16
      assert.equal(await stabilityPool.currentScale(), "2");

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: bob });
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: carol });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(10000, 18), { from: dennis });

      const alice_ETHWithdrawn = await getETHGainWithdrawn(txA).toString();
      const bob_ETHWithdrawn = await getETHGainWithdrawn(txB).toString();
      const carol_ETHWithdrawn = await getETHGainWithdrawn(txC).toString();
      const dennis_ETHWithdrawn = await getETHGainWithdrawn(txD).toString();

      // A, B, C should withdraw 0 - their deposits have been completely used up
      assert.equal(await boldToken.balanceOf(alice), "0");
      assert.equal(await boldToken.balanceOf(alice), "0");
      assert.equal(await boldToken.balanceOf(alice), "0");
      // D should withdraw around 0.9999 Bold, since his deposit of 9999.9 was reduced by a factor of 1e-5
      assert.isAtMost(th.getDifference((await boldToken.balanceOf(dennis)).toString(), dec(99999, 12)), 100000);

      // 99.5 ETH is offset at each L, 0.5 goes to gas comp
      // Each depositor gets ETH rewards of around 99.5 ETH - 1e17 error tolerance
      assert.isTrue(toBN(alice_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))));
      assert.isTrue(toBN(bob_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))));
      assert.isTrue(toBN(carol_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))));
      assert.isTrue(toBN(dennis_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))));
    });

    it("withdrawFromSP(): 2 depositors can withdraw after each receiving half of a pool-emptying liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Defaulters 1-3 each withdraw 24100, 24300, 24500 Bold (inc gas comp)
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(24100, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(200, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(24300, 18)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(200, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(24500, 18)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(200, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // A, B provide 10k Bold
      await boldToken.transfer(A, dec(10000, 18), { from: whale });
      await boldToken.transfer(B, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: A });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: B });

      // Defaulter 1 liquidated. SP emptied
      const txL1 = await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      assert.isTrue(txL1.receipt.status);

      // Check compounded deposits
      const A_deposit = await stabilityPool.getCompoundedBoldDeposit(A);
      const B_deposit = await stabilityPool.getCompoundedBoldDeposit(B);
      // console.log(`A_deposit: ${A_deposit}`)
      // console.log(`B_deposit: ${B_deposit}`)
      assert.equal(A_deposit, "0");
      assert.equal(B_deposit, "0");

      // Check SP tracker is zero
      const BoldinSP_1 = await stabilityPool.getTotalBoldDeposits();
      // console.log(`BoldinSP_1: ${BoldinSP_1}`)
      assert.equal(BoldinSP_1, "0");

      // Check SP Bold balance is zero
      const SPBoldBalance_1 = await boldToken.balanceOf(stabilityPool.address);
      // console.log(`SPBoldBalance_1: ${SPBoldBalance_1}`)
      assert.equal(SPBoldBalance_1, "0");

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txA = await th.withdrawFromSPAndClaim(contracts, dec(1000, 18), { from: A });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(1000, 18), { from: B });
      await priceFeed.setPrice(dec(100, 18));

      assert.isTrue(txA.receipt.status);
      assert.isTrue(txB.receipt.status);

      // ==========

      // C, D provide 10k Bold
      await boldToken.transfer(C, dec(10000, 18), { from: whale });
      await boldToken.transfer(D, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: C });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: D });

      // Defaulter 2 liquidated.  SP emptied
      const txL2 = await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isTrue(txL2.receipt.status);

      // Check compounded deposits
      const C_deposit = await stabilityPool.getCompoundedBoldDeposit(C);
      const D_deposit = await stabilityPool.getCompoundedBoldDeposit(D);
      // console.log(`A_deposit: ${C_deposit}`)
      // console.log(`B_deposit: ${D_deposit}`)
      assert.equal(C_deposit, "0");
      assert.equal(D_deposit, "0");

      // Check SP tracker is zero
      const BoldinSP_2 = await stabilityPool.getTotalBoldDeposits();
      // console.log(`BoldinSP_2: ${BoldinSP_2}`)
      assert.equal(BoldinSP_2, "0");

      // Check SP Bold balance is zero
      const SPBoldBalance_2 = await boldToken.balanceOf(stabilityPool.address);
      // console.log(`SPBoldBalance_2: ${SPBoldBalance_2}`)
      assert.equal(SPBoldBalance_2, "0");

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18));
      const txC = await th.withdrawFromSPAndClaim(contracts, dec(1000, 18), { from: C });
      const txD = await th.withdrawFromSPAndClaim(contracts, dec(1000, 18), { from: D });
      await priceFeed.setPrice(dec(100, 18));

      assert.isTrue(txC.receipt.status);
      assert.isTrue(txD.receipt.status);

      // ============

      // E, F provide 10k Bold
      await boldToken.transfer(E, dec(10000, 18), { from: whale });
      await boldToken.transfer(F, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: E });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: F });

      // Defaulter 3 liquidated. SP emptied
      const txL3 = await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      assert.isTrue(txL3.receipt.status);

      // Check compounded deposits
      const E_deposit = await stabilityPool.getCompoundedBoldDeposit(E);
      const F_deposit = await stabilityPool.getCompoundedBoldDeposit(F);
      // console.log(`E_deposit: ${E_deposit}`)
      // console.log(`F_deposit: ${F_deposit}`)
      assert.equal(E_deposit, "0");
      assert.equal(F_deposit, "0");

      // Check SP tracker is zero
      const BoldinSP_3 = await stabilityPool.getTotalBoldDeposits();
      assert.equal(BoldinSP_3, "0");

      // Check SP Bold balance is zero
      const SPBoldBalance_3 = await boldToken.balanceOf(stabilityPool.address);
      // console.log(`SPBoldBalance_3: ${SPBoldBalance_3}`)
      assert.equal(SPBoldBalance_3, "0");

      // Attempt withdrawals
      const txE = await th.withdrawFromSPAndClaim(contracts, dec(1000, 18), { from: E });
      const txF = await th.withdrawFromSPAndClaim(contracts, dec(1000, 18), { from: F });
      assert.isTrue(txE.receipt.status);
      assert.isTrue(txF.receipt.status);
    });

    // TODO: Changes since v1 have introduced very slight precision error in this test. Potentially due to slightly different rounding
    // in helper functon getOpenTroveBoldAmount due to now-zero borrow fees. Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): Depositor's ETH gain stops increasing after two scale changes", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // Defaulters 1-5 each withdraw up to debt of 9999.9999999 Bold
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(100, "ether") },
      );
      const defaulter_2_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_2,
        defaulter_2,
        0,
        { from: defaulter_2, value: dec(100, "ether") },
      );
      const defaulter_3_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_3,
        defaulter_3,
        0,
        { from: defaulter_3, value: dec(100, "ether") },
      );
      const defaulter_4_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_4,
        defaulter_4,
        0,
        { from: defaulter_4, value: dec(100, "ether") },
      );
      const defaulter_5_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(99999, 17)),
        defaulter_5,
        defaulter_5,
        0,
        { from: defaulter_5, value: dec(100, "ether") },
      );

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await boldToken.transfer(alice, dec(10000, 18), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(10000, 18), { from: alice });

      // Defaulter 1 liquidated.  P updated to 1e13
      const txL1 = await troveManager.liquidate(defaulter_1_TroveId, { from: owner });
      assert.isTrue(txL1.receipt.status);
      th.logBN("P", await stabilityPool.P()); // P = 0.000009999999999999, 1 wei less than expected
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 13))); // Expect P decreases to 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), "0");

      // B deposits 9999.9 Bold
      await boldToken.transfer(bob, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: bob });

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2_TroveId, { from: owner });
      assert.isTrue(txL2.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), toBN(dec(1, 17)), 10000); // Scale changes and P changes to 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), "1");

      // C deposits 9999.9 Bold
      await boldToken.transfer(carol, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: carol });

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3_TroveId, { from: owner });
      assert.isTrue(txL3.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 12), 1); // P decreases to 1e(17-5) = 1e12
      assert.equal(await stabilityPool.currentScale(), "1");

      // D deposits 9999.9 Bold
      await boldToken.transfer(dennis, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: dennis });

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4_TroveId, { from: owner });
      assert.isTrue(txL4.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 16), 10000); // Scale changes and P changes to 1e(12-5+9) = 1e16
      assert.equal(await stabilityPool.currentScale(), "2");

      const alice_ETHGainAt2ndScaleChange = (await stabilityPool.getDepositorCollGain(alice)).toString();

      // E deposits 9999.9 Bold
      await boldToken.transfer(erin, dec(99999, 17), { from: whale });
      await th.provideToSPAndClaim(contracts, dec(99999, 17), { from: erin });

      // Defaulter 5 liquidated
      const txL5 = await troveManager.liquidate(defaulter_5_TroveId, { from: owner });
      assert.isTrue(txL5.receipt.status);
      th.assertIsApproximatelyEqual(await stabilityPool.P(), dec(1, 11), 1); // P decreases to 1e(16-5) = 1e11
      assert.equal(await stabilityPool.currentScale(), "2");

      const alice_ETHGainAfterFurtherLiquidation = (await stabilityPool.getDepositorCollGain(alice)).toString();

      const alice_scaleSnapshot = (await stabilityPool.depositSnapshots(alice))[2].toString();

      assert.equal(alice_scaleSnapshot, "0");
      assert.equal(alice_ETHGainAt2ndScaleChange, alice_ETHGainAfterFurtherLiquidation);
    });

    // --- Extreme values, confirm no overflows ---

    it("withdrawFromSP(): Large liquidated coll/debt, deposits and ETH price", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));

      const depositors = [alice, bob];
      for (const account of depositors) {
        await th.openTroveWrapper(contracts, dec(1, 36), account, account, 0, {
          from: account,
          value: dec(2, 27),
        });
        await th.provideToSPAndClaim(contracts, dec(1, 36), { from: account });
      }

      // Defaulter opens trove with 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(1, 36)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: dec(1, 27) },
      );

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(1, 36), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(1, 36), { from: bob });

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = getETHGainWithdrawn(txA);
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB);

      // Check Bold balances
      const aliceBoldBalance = await boldToken.balanceOf(alice);
      const aliceExpectedBoldBalance = web3.utils.toBN(dec(5, 35));
      const aliceBoldBalDiff = aliceBoldBalance.sub(aliceExpectedBoldBalance).abs();

      assert.isTrue(aliceBoldBalDiff.lte(toBN(dec(1, 18)))); // error tolerance of 1e18

      const bobBoldBalance = await boldToken.balanceOf(bob);
      const bobExpectedBoldBalance = toBN(dec(5, 35));
      const bobBoldBalDiff = bobBoldBalance.sub(bobExpectedBoldBalance).abs();

      assert.isTrue(bobBoldBalDiff.lte(toBN(dec(1, 18))));

      // Check ETH gains
      const aliceExpectedETHGain = toBN(dec(4975, 23));
      const aliceETHDiff = aliceExpectedETHGain.sub(toBN(alice_ETHWithdrawn));

      assert.isTrue(aliceETHDiff.lte(toBN(dec(1, 18))));

      const bobExpectedETHGain = toBN(dec(4975, 23));
      const bobETHDiff = bobExpectedETHGain.sub(toBN(bob_ETHWithdrawn));

      assert.isTrue(bobETHDiff.lte(toBN(dec(1, 18))));
    });

    // TODO: Changes since v1 have made the error margin in this test  i.e. aliceBoldBalanceDiff increase 100x (but still low relative to the huge values used in test).
    // Potentially due to slightly different rounding in helper getOpenTroveBoldAmount due to now-zero borrow fees.
    // Double-check this when we write new SP arithmetic tests and fix the "P" issue.
    it("withdrawFromSP(): Small liquidated coll/debt, large deposits and ETH price", async () => {
      // Whale opens Trove with 100k ETH
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));
      const price = await priceFeed.getPrice();

      const depositors = [alice, bob];
      for (const account of depositors) {
        await th.openTroveWrapper(contracts, dec(1, 38), account, account, 0, {
          from: account,
          value: dec(2, 29),
        });
        await th.provideToSPAndClaim(contracts, dec(1, 38), { from: account });
      }

      // Defaulter opens trove with 50e-7 ETH and  5000 Bold. 200% ICR
      const defaulter_1_TroveId = await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(5000, 18)),
        defaulter_1,
        defaulter_1,
        0,
        { from: defaulter_1, value: "5000000000000" },
      );

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1_TroveId, { from: owner });

      const txA = await th.withdrawFromSPAndClaim(contracts, dec(1, 38), { from: alice });
      const txB = await th.withdrawFromSPAndClaim(contracts, dec(1, 38), { from: bob });

      const alice_ETHWithdrawn = getETHGainWithdrawn(txA);
      const bob_ETHWithdrawn = getETHGainWithdrawn(txB);

      const aliceBoldBalance = await boldToken.balanceOf(alice);
      const aliceExpectedBoldBalance = toBN("99999999999999997500000000000000000000");
      const aliceBoldBalDiff = aliceBoldBalance.sub(aliceExpectedBoldBalance).abs();

      // th.logBN("aliceBoldBalDiff", aliceBoldBalDiff);
      // the error is now 100, due to this line in StabilityPool._computeETHRewardsPerUnitStaked function
      // boldLossPerUnitStaked = boldLossNumerator / _totalBoldDeposits + 1;
      // if we remove the `+ 1`, the error would be 1 (dec(1, 18)) as before
      assert.isTrue(aliceBoldBalDiff.lte(toBN(dec(1, 20))));

      const bobBoldBalance = await boldToken.balanceOf(bob);
      const bobExpectedBoldBalance = toBN("99999999999999997500000000000000000000");
      const bobBoldBalDiff = bobBoldBalance.sub(bobExpectedBoldBalance).abs();

      assert.isTrue(bobBoldBalDiff.lte(toBN("100000000000000000000")));

      // Expect ETH gain per depositor of ~1e11 wei to be rounded to 0 by the ETHGainedPerUnitStaked calculation (e / D), where D is ~1e36.
      assert.equal(alice_ETHWithdrawn.toString(), "0");
      assert.equal(bob_ETHWithdrawn.toString(), "0");
    });
  });
});

contract("Reset chain state", async (accounts) => {});
