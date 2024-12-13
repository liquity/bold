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

  const getOpenTroveBoldAmount = async (totalDebt) => th.getOpenTroveBoldAmount(contracts, totalDebt);
  const openTrove = async (params) => th.openTrove(contracts, params);
  const getBoldAmountForDesiredDebt = async (desiredDebt) => (await getOpenTroveBoldAmount(dec(desiredDebt, 18)));

  const deployFixture = createDeployAndFundFixture({
    accounts: fundedAccounts,
    callback: async (contracts) => {
      await contracts.priceFeed.setPrice(dec(200, 18));
    },
    mocks: {
      TroveManager: TroveManagerTester,
    },
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
    it("1. Liquidation succeeds after 2 high-fraction liquidations", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts, await getBoldAmountForDesiredDebt(2000), account, account, 0, {
          from: account,
          value: dec(15, "ether"),
        });

        // th.logBN("Trove debt", await th.getTroveEntireDebtByAddress(contracts, account));

        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18)),
          ),
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await th.provideToSPAndClaim(contracts, deposit_0, { from: A });

      // console.log("P0:");
      const P_0 = await stabilityPool.P();
      // console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      // console.log("P1:");
      // console.log(P_1.toString());

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P is still 1e9
      const P_2 = await stabilityPool.P();
      console.log("P2:");
      console.log(P_2.toString());
      assert.isTrue(P_2.eq(th.toBN(dec(1, 9))));
    
      // A re-fills SP to same pre-liq level again
      const deposit_2 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      // Without fix: fails here
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // // This final liq fails. As expected, the 'assert' in SP line 618 reverts, since 'newP' equals 0 inside the final liq
      // // TODO: Fix this invariant violation whereby P can be reduced < 1e9 (but see v1 security advisory for liq workaround and
      // // low-severity assessment).
    });

    it("2. New deposits can be made after 2 high fraction liquidations", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts, await getBoldAmountForDesiredDebt(2000), account, account, 0, {
          from: account,
          value: dec(15, "ether"),
        });
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18)),
          ),
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await th.provideToSPAndClaim(contracts, deposit_0, { from: A });

      // console.log("P0:");
      const P_0 = await stabilityPool.P();
      // console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P remains above 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      // console.log("P1:");
      // console.log(P_1.toString());

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P is still 1e9
      const P_2 = await stabilityPool.P();
      console.log("P2:");
      console.log(P_2.toString());
      assert.isTrue(P_2.eq(th.toBN(dec(1, 9))));

      // A re-fills SP to same pre-liq level again
      const deposit_2 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_2, { from: A });

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
        await th.provideToSPAndClaim(contracts, newDeposits[i], {
          from: newDepositors[i],
        });
        assert.isTrue(
          (await stabilityPool.getCompoundedBoldDeposit(newDepositors[i])).eq(
            newDeposits[i],
          ),
        );
      }
    });

    it("3. Liquidation succeeds when P == 1e9 liquidation has newProductFactor == 1e9", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts, await getBoldAmountForDesiredDebt(2000), account, account, 0, {
          from: account,
          value: dec(15, "ether"),
        });
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18)),
          ),
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await th.provideToSPAndClaim(contracts, deposit_0, { from: A });

      // console.log("P0:");
      const P_0 = await stabilityPool.P();
      // console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      // console.log("scale:");
      // console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      // console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      // console.log("P1:");
      // console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      // console.log("scale:");
      // console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      // console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P is still at least 1e9
      const P_2 = await stabilityPool.P();
      console.log("P2:");
      console.log(P_2.toString());
      assert.isTrue(P_2.eq(th.toBN(dec(1, 9))));
      // Check scale increased twice
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      // console.log("scale:");
      // console.log(scale);

      // A re-fills SP to ~1.000000001x pre-liq level, i.e. to trigger a newProductFactor == 1e9,
      // (and trigger scale change)
      const deposit_2 = deposit_0
        .sub(await stabilityPool.getTotalBoldDeposits())
        .add(th.toBN(dec(2, 12)));
      await th.provideToSPAndClaim(contracts, deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      // console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P remains the same. Pool depletes to 1 billion'th of prior size, so newProductFactor is 1e9.
      // Due to scale change, raw value of P should equal (1e9 * 1e9 * 1e9 / 1e18) = 1, i.e. should not change.
      const P_3 = await stabilityPool.P();
      console.log("P3:");
      console.log(P_3.toString());
      assert.isTrue(P_3.eq(th.toBN(dec(1, 9))));
      // console.log("P_3:");
      // console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "4");
      // console.log("scale:");
      // console.log(scale);
    });

    it("4. Liquidation succeeds when P == 1e9 and liquidation has newProductFactor > 1e9", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts, await getBoldAmountForDesiredDebt(2000), account, account, 0, {
          from: account,
          value: dec(15, "ether"),
        });
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18)),
          ),
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await th.provideToSPAndClaim(contracts, deposit_0, { from: A });

      // console.log("P0:");
      const P_0 = await stabilityPool.P();
      // console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      // console.log("scale:");
      // console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      // console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      // console.log("P1:");
      // console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      // console.log("scale:");
      // console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      // console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      console.log(P_2.toString());
      assert.isTrue(P_2.eq(th.toBN(dec(1, 9))));
      console.log("P2:");
      console.log(P_2.toString());
      // Expect 2 scale changes
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      // console.log("scale:");
      // console.log(scale);

      // A re-fills SP to ~2x pre-liq level, i.e. to trigger a newProductFactor > 1e9,
      // and trigger scale change and *increase* raw value of P again.
      const deposit_2 = deposit_0
        .mul(th.toBN(2))
        .sub(await stabilityPool.getTotalBoldDeposits());
      await th.provideToSPAndClaim(contracts, deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      // console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P increases: 50% of the pool is liquidated, and there is a scale change. Pool depletion is 50%, so newProductFactor is 5e17.
      // Raw value of P should change from 1e9 to (1e9 * 5e17 * 1e9 / 1e18)= 5e17.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(dec(5, 17))));
      console.log("P_3:");
      console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      // Expect 1 more scale change
      assert.equal(scale, "4");
      // console.log("scale:");
      // console.log(scale);
    });

    // --- Check depositors have correct stakes after experiencing scale change from depositing when P is tiny  ---

    it("5. Depositor have correct depleted stake after deposit at P == 1e9 and scale changing liq (with newProductFactor == 1e9)", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts, await getBoldAmountForDesiredDebt(2000), account, account, 0, {
          from: account,
          value: dec(15, "ether"),
        });
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18)),
          ),
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await th.provideToSPAndClaim(contracts, deposit_0, { from: A });

      // console.log("P0:");
      const P_0 = await stabilityPool.P();
      // console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      // console.log("scale:");
      // console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      // console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      // console.log("P1:");
      // console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      // console.log("scale:");
      // console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      // console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P remains at 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(dec(1, 9))));
      // console.log("P2:");
      // console.log(P_2.toString());
      scale = (await stabilityPool.currentScale()).toString();
      // 2 scale changes
      assert.equal(scale, "3");
      // console.log("scale:");
      // console.log(scale);

      // D makes deposit of 1000 Bold
      const D_deposit = dec(1, 21);
      await boldToken.transfer(D, dec(1, 21), { from: whale });
      await th.provideToSPAndClaim(contracts, D_deposit, { from: D });

      // A re-fills SP to ~1.000000001x pre-liq level, i.e. to trigger a newProductFactor == 1e9,
      // (and trigger scale change)
      const deposit_2 = deposit_0
        .sub(await stabilityPool.getTotalBoldDeposits())
        .add(th.toBN(dec(2, 12)));
      await th.provideToSPAndClaim(contracts, deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      // console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check liq succeeds and P remains the same. // Pool depletes to 1 billion'th of prior size, so newProductFactor is 1e9.
      // Due to scale change, raw value of P should equal (1 * 1e9 * 1e9 / 1e18) = 1, i.e. should not change.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(dec(1,9))));
      // console.log("P_3:");
      // console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "4");
      // console.log("scale:");
      // console.log(scale);

      // Check D's deposit has depleted to a billion'th of their initial deposit. That is, from 1e21 to 1e(21-9) = 1e12
      const D_depletedDeposit = await stabilityPool.getCompoundedBoldDeposit(D);
      assert.isTrue(D_depletedDeposit.eq(th.toBN(dec(1, 12))));
      // console.log("D_depletedDeposit:");
      // console.log(D_depletedDeposit.toString());
    });

    it("6. Depositor have correct depleted stake after deposit at P == 1e9 and scale changing liq (with newProductFactor > 1e9)", async () => {
      // Whale opens Trove with 100k ETH and sends 50k Bold to A
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(100000, 18)), whale, whale, 0, {
        from: whale,
        value: dec(100000, "ether"),
      });
      await boldToken.transfer(A, dec(50000, 18), { from: whale });

      // Open 3 Troves with 2000 Bold debt
      for (const account of [A, B, C]) {
        await th.openTroveWrapper(contracts, await getBoldAmountForDesiredDebt(2000), account, account, 0, {
          from: account,
          value: dec(15, "ether"),
        });
        assert.isTrue(
          (await th.getTroveEntireDebtByAddress(contracts, account)).eq(
            th.toBN(dec(2000, 18)),
          ),
        );
      }

      // A  deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await th.provideToSPAndClaim(contracts, deposit_0, { from: A });

      // console.log("P0:");
      const P_0 = await stabilityPool.P();
      // console.log(P_0.toString());
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      // console.log("scale:");
      // console.log(scale);

      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      // console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      // console.log("P1:");
      // console.log(P_1.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      // console.log("scale:");
      // console.log(scale);

      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(
        await stabilityPool.getTotalBoldDeposits(),
      );
      await th.provideToSPAndClaim(contracts, deposit_1, { from: A });

      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      // console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P reduced by factor of 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(dec(1, 9))));
      // console.log("P2:");
      // console.log(P_2.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "3");
      // console.log("scale:");
      // console.log(scale);

      // D makes deposit of 1000 Bold
      const D_deposit = dec(1, 21);
      await boldToken.transfer(D, dec(1, 21), { from: whale });
      await th.provideToSPAndClaim(contracts, D_deposit, { from: D });

      // A re-fills SP to ~2x pre-liq level, i.e. to trigger a newProductFactor > 1e9,
      // and trigger scale change and *increase* raw value of P again.
      const deposit_2 = deposit_0
        .mul(th.toBN(2))
        .sub(await stabilityPool.getTotalBoldDeposits());
      await th.provideToSPAndClaim(contracts, deposit_2, { from: A });

      // Price drop -> liquidate Trove C -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      // console.log("LIQ 3");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check P increases: 50% of the pool is liquidated, and there is a scale change. Pool depletion is 50%, so newProductFactor is 5e17.
      // Raw value of P should change from 1 to (1e9 * 5e17 * 1e9 / 1e18)= 5e17.
      const P_3 = await stabilityPool.P();
      assert.isTrue(P_3.eq(th.toBN(dec(5, 17))));
      // console.log("P_3:");
      // console.log(P_3.toString());
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "4");
      // console.log("scale:");
      // console.log(scale);

      // Check D's deposit has depleted to 50% their initial deposit. That is, from 1e21 to 5e20.
      const D_depletedDeposit = await stabilityPool.getCompoundedBoldDeposit(D);
      assert.isTrue(D_depletedDeposit.eq(th.toBN(dec(5, 20))));
      // console.log("D_depletedDeposit:");
      // console.log(D_depletedDeposit.toString());
    });

    it("7. Two consecutive liquidations when P == 1e9 and liquidations have newProductFactor > 1e9 prematurely deplete deposits with minimal (and capped) collateral reward", async () => {
      // Whale opens Trove with 100k ETH and sends 50k BOLD to A
      await th.openTroveWrapper(
        contracts,
        await getOpenTroveBoldAmount(dec(100000, 18)),
        whale,
        whale,
        0,
        { from: whale, value: dec(100000, "ether") }
      );
      assert.isTrue((await th.getTroveEntireDebtByAddress(contracts, whale)).eq(th.toBN(dec(100000, 18))));

      await boldToken.transfer(A, dec(50000, 18), { from: whale });
      // Open 4 Troves with 2000 BOLD debt
      for (account of [A, B, C, D]) {
        await th.openTroveWrapper(
          contracts,
          await getOpenTroveBoldAmount(dec(2000, 18)),
          account,
          account,
          0,
          { from: account, value: dec(15, "ether") }
        );
      }
      assert.isTrue((await th.getTroveEntireDebtByAddress(contracts, A)).eq(th.toBN(dec(2000, 18))));
      
      // Open 1 Trove with 16000 BOLD debt
      await th.openTroveWrapper(contracts, await getOpenTroveBoldAmount(dec(16001, 18)), E, E, 0, {
        from: E,
        value: dec(1215, 17),
      });
      assert.isTrue((await th.getTroveEntireDebtByAddress(contracts, E)).eq(th.toBN(dec(16001, 18))));
      // A deposits to SP - i.e. minimum needed to reduce P to 1e9 from a 2000 debt liquidation
      const deposit_0 = th.toBN("2000000000000000002001");
      await stabilityPool.provideToSP(deposit_0, ZERO_ADDRESS, { from: A });
      console.log("P0:");
      const P_0 = await stabilityPool.P();
      console.log(P_0.toString()); // 1.0
      assert.equal(P_0, dec(1, 18));
      let scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "0");
      console.log("scale:");
      console.log(scale); // 0
      // Price drop -> liquidate Trove A -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(A), { from: owner });
      console.log("LIQ 1");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(A)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));
      // Check P reduced by factor of 1e9
      const P_1 = await stabilityPool.P();
      assert.equal(P_1, dec(1, 9));
      console.log("P1:");
      console.log(P_1.toString()); // 0.000000001 (1e-9)
      scale = (await stabilityPool.currentScale()).toString();
      assert.equal(scale, "1");
      console.log("scale:");
      console.log(scale); // 1
      // A re-fills SP back up to deposit 0 level, i.e. just enough to reduce P by 1e9 from a 2k debt liq.
      const deposit_1 = deposit_0.sub(await stabilityPool.getTotalBoldDeposits());
      await stabilityPool.provideToSP(deposit_1, ZERO_ADDRESS, { from: A });
      // Price drop -> liquidate Trove B -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(B), { from: owner });
      console.log("LIQ 2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(B)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));
      // Check P remains at 1e9
      const P_2 = await stabilityPool.P();
      assert.isTrue(P_2.eq(th.toBN(dec(1,9))));
      console.log("P2:");
      console.log(P_2.toString());// 1e-9
      scale = (await stabilityPool.currentScale()).toString();
      // 2 scale changes
      assert.equal(scale, "3");
      console.log("scale:");
      console.log(scale); // 3
      // A re-fills SP to ~10x pre-liq level, which will trigger a newProduct Factor ≈ 9e17
      // when a minimal size trove is liquidated.
      const deposit_2 = deposit_0.mul(th.toBN(10)).sub(await stabilityPool.getTotalBoldDeposits());
      await stabilityPool.provideToSP(deposit_2, ZERO_ADDRESS, { from: A });
      // Price drop -> liquidate Trove C and Trove D consecutively-> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(C), { from: owner });
      console.log("LIQ 3.1");
      await troveManager.liquidate(th.addressToTroveId(D), { from: owner });
      console.log("LIQ 3.2");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(C)), 3); // status: closed by liq
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(D)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));

      // Check A's deposit is still non-zero, and they have the correct earned collateral
      const P_3 = await stabilityPool.P();
      console.log("P_3:");
      console.log(P_3.toString()); // 0.8
      assert.isTrue(P_3.eq(th.toBN(dec(8, 17))));
      scale = (await stabilityPool.currentScale()).toString();
      console.log("scale:");
      console.log(scale); // 4
      assert.equal(scale, "4");
      const A_Deposit_Value = await stabilityPool.getCompoundedBoldDeposit(A);
      console.log("A's compounded BOLD deposit:");
      console.log(A_Deposit_Value.toString()); // 0
      assert.isTrue(A_Deposit_Value.gt(th.toBN(0)));
      const A_Earned_Collateral = await stabilityPool.getDepositorCollGain(A);
      console.log("A's earned ETH collateral:");
      console.log(A_Earned_Collateral.toString()); // 29.849999999999980026
      th.assertIsApproximatelyEqual(
        A_Earned_Collateral,
        th.toBN(2 * dec(15, "ether") * 0.995),
        1e5
      );

      // // Here we will cache the amount of raw ETH in the stability pool contract, the totalBOLDDeposits, and the epoch counter.
      const Stability_Pool_ETH = await stabilityPool.getCollBalance();
      console.log("Stability Pool ETH before complete liquidation LIQ4:");
      console.log(Stability_Pool_ETH.toString()); // 29.850000000000001986
      const Total_BOLD_Deposits = await stabilityPool.getTotalBoldDeposits();
      console.log("Total Stability Pool BOLD Deposits before complete liquidation LIQ4:");
      console.log(Total_BOLD_Deposits.toString()); // 16000.000000000000020010
      const Current_Epoch = await stabilityPool.currentEpoch();
      console.log("Epoch before complete liquidation LIQ4:");
      console.log(Current_Epoch.toString()); // 0
      // // Next, say some trove is liquidated which fully offsets the stability pool balance, triggering an epoch increment.
      // // Earlier, E's trove was defined to be the amount that is now in the stability pool, so liquidating it will offset the whole pool.
      // // The liquidation will go through because 81% of A's deposit is still a part of the variable 'totalBOLDDeposits'.
      // // Price drop -> liquidate Trove E -> price rises
      await priceFeed.setPrice(dec(100, 18));
      await troveManager.liquidate(th.addressToTroveId(E), { from: owner });
      console.log("LIQ 4");
      assert.equal(await troveManager.getTroveStatus(th.addressToTroveId(E)), 3); // status: closed by liq
      await priceFeed.setPrice(dec(200, 18));
      // // Check: we can check that the full trove was indeed offset, by ensuring that the pool's BOLD balance is now 0,
      // // the epoch counter has incremented, and the P value is reset to 1e18.
      const Stability_Pool_ETH_2 = await stabilityPool.getCollBalance();
      console.log("Stability Pool ETH after complete liquidation LIQ4:");
      console.log(Stability_Pool_ETH_2.toString()); // 150.734944690956817336
      const Total_BOLD_Deposits_2 = await stabilityPool.getTotalBoldDeposits();
      console.log("Total Stability Pool BOLD Deposits after complete liquidation LIQ4:");
      console.log(Total_BOLD_Deposits_2.toString()); // 0
      assert.equal(Total_BOLD_Deposits_2, 0);
      const Current_Epoch_2 = await stabilityPool.currentEpoch();
      console.log("Epoch after complete liquidation LIQ4:");
      console.log(Current_Epoch.toString()); // 0
      assert.equal(Current_Epoch_2.sub(Current_Epoch), 1);
      const P_4 = await stabilityPool.P();
      console.log("P after complete liquidation LIQ4:");
      console.log(P_4.toString()); // 1.000000000000000000
      assert.equal(P_4, dec(1, 18));
      // // Exploit chec
      // // Regardless of the size of this liquidation, A will not earn any more ETH than they did from the last two liquidations (LIQ 2 and 3).
      // // This is because the scale increment is two increments ahead of A's scale snapshot, so they cannot earn collateral in the present scale.
      // // A's compounded deposit will still be 0 and their earned collateral will still be what it was after LIQ 2 and 3 (A_Earned_Collateral).
      // // This test fails when the bug is not fixed.
      const A_Deposit_Value_2 = await stabilityPool.getCompoundedBoldDeposit(A);
      console.log("A's compounded BOLD deposit after complete liquidation LIQ4:");
      console.log(A_Deposit_Value_2.toString()); // 0
      assert.isTrue(A_Deposit_Value_2.eq(th.toBN(0)));
      const A_Earned_Collateral_2 = th.toBN(await stabilityPool.getDepositorCollGain(A));
      console.log("A's earned ETH collateral after complete liquidation LIQ4:");
      console.log(A_Earned_Collateral_2.toString()); // 29.849999999999980026 
      assert.isTrue(A_Earned_Collateral_2.gt(A_Earned_Collateral));
    });
  });
});
