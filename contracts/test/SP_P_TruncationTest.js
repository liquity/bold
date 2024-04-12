const { TestHelper: th } = require("../utils/testHelpers.js");
const { createDeployAndFundFixture } = require("../utils/testFixtures.js");

const { dec } = th;

const TroveManagerTester = artifacts.require("TroveManagerTester");
const BoldToken = artifacts.require("BoldToken");

const GAS_PRICE = 10000000;

contract("StabilityPool Scale Factor issue tests", async (accounts) => {
  const fundedAccounts = accounts.slice(0, 11);

  const [owner, whale, A, B, C, D, E, F, F1, F2, F3] = fundedAccounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;

  let priceFeed;
  let boldToken;
  let stabilityPool;
  let sortedTroves;
  let troveManager;
  let borrowerOperations;

  const ZERO_ADDRESS = th.ZERO_ADDRESS;

  const getOpenTroveBoldAmount = async (totalDebt) =>
    th.getOpenTroveBoldAmount(contracts, totalDebt);
  const openTrove = async (params) => th.openTrove(contracts, params);
  const getBoldAmountForDesiredDebt = async (desiredDebt) =>
    (await getOpenTroveBoldAmount(dec(desiredDebt, 18)));

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    callback: async (contracts) => {
      await contracts.priceFeed.setPrice(dec(200, 18));
    },
    mocks: {
      TroveManager: TroveManagerTester,
    }
  });

  beforeEach(async () => {
    const result = await deployFixture();
    contracts = result.contracts;
    priceFeed = contracts.priceFeed;
    boldToken = contracts.boldToken;
    stabilityPool = contracts.stabilityPool;
    sortedTroves = contracts.sortedTroves;
    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations;
  });

  describe("Scale Factor issue tests", async () => {
    it.skip("1. Liquidation succeeds after P reduced to 1", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        { from: whale, value: dec(100000, "ether") }
      );
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts,
          th._100pct,
          await getBoldAmountForDesiredDebt(2000),
          account,
          account,
          { from: account, value: dec(15, "ether") }
        );

        //th.logBN("Trove debt", await th.getTroveEntireDebtByAddress(contracts, account));

        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18))
          )
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, { from: A });

      //console.log("P0:");
      const P_0 = await stabilityPool.P();
      //console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      //console.log("P1:");
      //console.log(P_1.toString());

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(1)));
      //console.log("P2:");
      //console.log(P_2.toString());

      // A re-fills SP to same pre-liq level again
      const deposit_2 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(C, { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // This final liq fails. As expected, the 'assert' in SP line 618 reverts, since 'newP' equals 0 inside the final liq
      // TODO: Fix this invariant violation whereby P can be reduced < 1e9 (but see v1 security advisory for liq workaround and 
      // low-severity assessment).
    });

    it("2. New deposits can be made after P reduced to 1", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(100000, "ether") }
      );
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts,
          th._100pct,
          await getBoldAmountForDesiredDebt(2000),
          account,
          account,
          0,
          { from: account, value: dec(15, "ether") }
        );
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18))
          )
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, { from: A });

      //console.log("P0:");
      const P_0 = await stabilityPool.P();
      //console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      //console.log("P1:");
      //console.log(P_1.toString());

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.equal(P_2, dec(1, 0));
      //console.log("P2:");
      //console.log(P_2.toString());

      // A re-fills SP to same pre-liq level again
      const deposit_2 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_2, { from: A });

      // Whale gives Bold to D,E,F
      const newDeposits = [
        th.toBN(1),
        th.toBN(dec(10000, 18)),
        th.toBN(dec(20000, 18)),
      ];
      const newDepositors = [D, E, F];

      for (let i = 0; i < 3; i++) {
        await boldToken.transfer(newDepositors[i], newDeposits[i], {
          from: whale,
        });
        await stabilityPool.provideToSP(newDeposits[i], {
          from: newDepositors[i],
        });
        assert.isTrue(
          (await stabilityPool.getCompoundedBoldDeposit(newDepositors[i])).eq(
            newDeposits[i]
          )
        );
      }
    });

    it("3. Liquidation succeeds when P == 1 and liquidation has newProductFactor == 1e9", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(100000, "ether") }
      );
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts,
          th._100pct,
          await getBoldAmountForDesiredDebt(2000),
          account,
          account,
          0,
          { from: account, value: dec(15, "ether") }
        );
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18))
          )
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, { from: A });

      //console.log("P0:");
      const P_0 = await stabilityPool.P();
      //console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      //console.log("scale:");
      //console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      //console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      //console.log("P1:");
      //console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      //console.log("scale:");
      //console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      //console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(1)));
      //console.log("P2:");
      //console.log(P_2.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "2");
      //console.log("scale:");
      //console.log(scale);

      // A re-fills SP to ~1.000000001x pre-liq level, i.e. to trigger a newProductFactor == 1e9,
      // (and trigger scale change)
      const deposit_2 = deposit_0
        .sub(await stabilityPool.getTotalBoldDeposits())
        .add(th.toBN(dec(2, 12)));
      await stabilityPool.provideToSP(deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      //console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P remains the same. Pool depletes to 1 billion'th of prior size, so newProductFactor is 1e9.
      // Due to scale change, raw value of P should equal (1 * 1e9 * 1e9 / 1e18) = 1, i.e. should not change.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(1)));
      //console.log("P_3:");
      //console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      //console.log("scale:");
      //console.log(scale);
    });

    it("4. Liquidation succeeds when P == 1 and liquidation has newProductFactor > 1e9", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(100000, "ether") }
      );
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts,
          th._100pct,
          await getBoldAmountForDesiredDebt(2000),
          account,
          account,
          0,
          { from: account, value: dec(15, "ether") }
        );
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18))
          )
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, { from: A });

      //console.log("P0:");
      const P_0 = await stabilityPool.P();
      //console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      //console.log("scale:");
      //console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      //console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      //console.log("P1:");
      //console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      //console.log("scale:");
      //console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      //console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(1)));
      //console.log("P2:");
      //console.log(P_2.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "2");
      //console.log("scale:");
      //console.log(scale);

      // A re-fills SP to ~2x pre-liq level, i.e. to trigger a newProductFactor > 1e9,
      // and trigger scale change and *increase* raw value of P again.
      const deposit_2 = deposit_0
        .mul(th.toBN(2))
        .sub(await stabilityPool.getTotalBoldDeposits());
      await stabilityPool.provideToSP(deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      //console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P increases: 50% of the pool is liquidated, and there is a scale change. Pool depletion is 50%, so newProductFactor is 5e17.
      // Raw value of P should change from 1 to (1 * 5e17 * 1e9 / 1e18)= 5e8.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(dec(5, 8))));
      //console.log("P_3:");
      //console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      //console.log("scale:");
      //console.log(scale);
    });

    // --- Check depositors have correct stakes after experiencing scale change from depositing when P is tiny  ---

    it("5. Depositor have correct depleted stake after deposit at P == 1 and scale changing liq (with newProductFactor == 1e9)", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(100000, "ether") }
      );
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts,
          th._100pct,
          await getBoldAmountForDesiredDebt(2000),
          account,
          account,
          0,
          { from: account, value: dec(15, "ether") }
        );
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18))
          )
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, { from: A });

      //console.log("P0:");
      const P_0 = await stabilityPool.P();
      //console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      //console.log("scale:");
      //console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      //console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      //console.log("P1:");
      //console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      //console.log("scale:");
      //console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      //console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(1)));
      //console.log("P2:");
      //console.log(P_2.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "2");
      //console.log("scale:");
      //console.log(scale);

      // D makes deposit of 1000 Bold
      const D_deposit = dec(1, 21);
      await boldToken.transfer(D, dec(1, 21), { from: whale });
      await stabilityPool.provideToSP(D_deposit, { from: D });

      // A re-fills SP to ~1.000000001x pre-liq level, i.e. to trigger a newProductFactor == 1e9,
      // (and trigger scale change)
      const deposit_2 = deposit_0
        .sub(await stabilityPool.getTotalBoldDeposits())
        .add(th.toBN(dec(2, 12)));
      await stabilityPool.provideToSP(deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      //console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check liq succeeds and P remains the same. // Pool depletes to 1 billion'th of prior size, so newProductFactor is 1e9.
      // Due to scale change, raw value of P should equal (1 * 1e9 * 1e9 / 1e18) = 1, i.e. should not change.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(1)));
      //console.log("P_3:");
      //console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      //console.log("scale:");
      //console.log(scale);

      // Check D's deposit has depleted to a billion'th of their initial deposit. That is, from 1e21 to 1e(21-9) = 1e12
      const D_depletedDeposit = await stabilityPool.getCompoundedBoldDeposit(D);
      assert.isTrue(D_depletedDeposit.eq(th.toBN(dec(1, 12))));
      //console.log("D_depletedDeposit:");
      //console.log(D_depletedDeposit.toString());
    });

    it("6. Depositor have correct depleted stake after deposit at P == 1 and scale changing liq (with newProductFactor > 1e9)", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts,
        th._100pct,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(100000, "ether") }
      );
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts,
          th._100pct,
          await getBoldAmountForDesiredDebt(2000),
          account,
          account,
          0,
          { from: account, value: dec(15, "ether") }
        );
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18))
          )
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, { from: A });

      //console.log("P0:");
      const P_0 = await stabilityPool.P();
      //console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      //console.log("scale:");
      //console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      //console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      //console.log("P1:");
      //console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      //console.log("scale:");
      //console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits()
      );
      await stabilityPool.provideToSP(deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      //console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(1)));
      //console.log("P2:");
      //console.log(P_2.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "2");
      //console.log("scale:");
      //console.log(scale);

      // D makes deposit of 1000 Bold
      const D_deposit = dec(1, 21);
      await boldToken.transfer(D, dec(1, 21), { from: whale });
      await stabilityPool.provideToSP(D_deposit, { from: D });

      // A re-fills SP to ~2x pre-liq level, i.e. to trigger a newProductFactor > 1e9,
      // and trigger scale change and *increase* raw value of P again.
      const deposit_2 = deposit_0
        .mul(th.toBN(2))
        .sub(await stabilityPool.getTotalBoldDeposits());
      await stabilityPool.provideToSP(deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      //console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P increases: 50% of the pool is liquidated, and there is a scale change. Pool depletion is 50%, so newProductFactor is 5e17.
      // Raw value of P should change from 1 to (1 * 5e17 * 1e9 / 1e18)= 5e8.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(dec(5, 8))));
      //console.log("P_3:");
      //console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      //console.log("scale:");
      //console.log(scale);

      // Check D's deposit has depleted to 50% their initial deposit. That is, from 1e21 to 5e20.
      const D_depletedDeposit = await stabilityPool.getCompoundedBoldDeposit(D);
      assert.isTrue(D_depletedDeposit.eq(th.toBN(dec(5, 20))));
      //console.log("D_depletedDeposit:");
      //console.log(D_depletedDeposit.toString());
    });
  });
});
