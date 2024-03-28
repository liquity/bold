const deploymentHelper = require("../utils/deploymentHelpers.js");
const testHelpers = require("../utils/testHelpers.js");
const { fundAccounts } = require("../utils/fundAccounts.js");
const TroveManagerTester = artifacts.require("TroveManagerTester");

const th = testHelpers.TestHelper;
const timeValues = testHelpers.TimeValues;

const dec = th.dec;
const toBN = th.toBN;

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the Liquity admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract(
  "Access Control: Liquity functions with the caller restricted to Liquity contract(s)",
  async (accounts) => {
    const [owner, alice, bob, carol] = accounts;
    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(
      997,
      1000
    );

    let coreContracts;

    let priceFeed;
    let boldToken;
    let sortedTroves;
    let troveManager;
    let nameRegistry;
    let activePool;
    let stabilityPool;
    let defaultPool;
    let functionCaller;
    let borrowerOperations;

    before(async () => {
      coreContracts = await deploymentHelper.deployLiquityCore();
      coreContracts.troveManager = await TroveManagerTester.new();
      // TODO: coreContracts = await deploymentHelper.deployBoldTokenTester(coreContracts)
    
      priceFeed = coreContracts.priceFeed;
      boldToken = coreContracts.boldToken;
      sortedTroves = coreContracts.sortedTroves;
      troveManager = coreContracts.troveManager;
      nameRegistry = coreContracts.nameRegistry;
      activePool = coreContracts.activePool;
      stabilityPool = coreContracts.stabilityPool;
      defaultPool = coreContracts.defaultPool;
      functionCaller = coreContracts.functionCaller;
      borrowerOperations = coreContracts.borrowerOperations;

      await deploymentHelper.connectCoreContracts(coreContracts);


      await fundAccounts(accounts.slice(0, 10), coreContracts.WETH);

      for (const account of accounts.slice(0, 10)) {
        await th.openTrove(coreContracts, {
          extraBoldAmount: toBN(dec(20000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account },
        });
      }
    });

    describe("BorrowerOperations", async (accounts) => {
      it("moveETHGainToTrove(): reverts when called by an account that is not StabilityPool", async () => {
        // Attempt call from alice
        try {
          const tx1 = await borrowerOperations.moveETHGainToTrove(
            bob,
            th.addressToTroveId(bob),
            1,
            { from: bob }
          );
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "BorrowerOps: Caller is not Stability Pool")
        }
      });
    });

    describe("TroveManager", async (accounts) => {
      // getAndApplyRedistributionGains
      it("getAndApplyRedistributionGains(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.getAndApplyRedistributionGains(th.addressToTroveId(bob), {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      // removeStake
      it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.removeStake(bob, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      // updateStakeAndTotalStakes
      it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.updateStakeAndTotalStakes(th.addressToTroveId(bob), {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      // closeTrove
      it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.closeTrove(th.addressToTroveId(bob), { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      // addTroveIdToArray
      it("addTroveIdToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.addTroveIdToArray(th.addressToTroveId(bob), {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      // updateTroveColl
      it("updateTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.updateTroveColl(bob, th.addressToTroveId(bob), 100, true, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });

      // updateTroveDebt
      it("updateTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        try {
          const txAlice = await troveManager.updateTroveDebt(bob, th.addressToTroveId(bob), 100, true, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is not the BorrowerOperations contract")
        }
      });
    });

    describe("ActivePool", async (accounts) => {
      // sendETH
      it("sendETH(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
        // Attempt call from alice
        try {
          const txAlice = await activePool.sendETH(alice, 100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
          );
        }
      });

      // sendETHToDefaultPool
      it("sendETHToDefaultPool(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await activePool.sendETHToDefaultPool(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "ActivePool: Caller is not TroveManager"
          );
        }
      });

      // increaseBold
      it("increaseBoldDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
        // Attempt call from alice
        try {
          const txAlice = await activePool.increaseRecordedDebtSum(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "Caller is neither BorrowerOperations nor TroveManager"
          );
        }
      });

      // decreaseBold
      it("decreaseBoldDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
        // Attempt call from alice
        try {
          const txAlice = await activePool.decreaseRecordedDebtSum(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
          );
        }
      });

      // receiveETH (payment)
      it("receiveETH(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
        // Attempt call from alice
        try {
          await activePool.receiveETH(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "ActivePool: Caller is neither BO nor Default Pool"
          );
        }
      });
    });

    describe("DefaultPool", async (accounts) => {
      // sendETHToActivePool
      it("sendETHToActivePool(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await defaultPool.sendETHToActivePool(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the TroveManager");
        }
      });

      // increaseBold
      it("increaseBoldDebt(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await defaultPool.increaseBoldDebt(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the TroveManager");
        }
      });

      // decreaseBold
      it("decreaseBold(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await defaultPool.decreaseBoldDebt(100, {
            from: alice,
          });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the TroveManager");
        }
      });

      // receiveETH (payment)
      it("receiveETH(): reverts when called by an account that is not the Active Pool", async () => {
        // Attempt call from alice
        try {
          await defaultPool.receiveETH(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "DefaultPool: Caller is not the ActivePool"
          );
        }
      });
    });

    describe("StabilityPool", async (accounts) => {
      // --- onlyTroveManager ---

      // offset
      it("offset(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          txAlice = await stabilityPool.offset(100, 10, { from: alice });
          assert.fail(txAlice);
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not TroveManager");
        }
      });

      // --- onlyActivePool ---

      // receiveETH (payment)
      it("receiveETH(): reverts when called by an account that is not the Active Pool", async () => {
        // Attempt call from alice
        try {
          await stabilityPool.receiveETH(100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(
            err.message,
            "StabilityPool: Caller is not ActivePool"
          );
        }
      });
    });

    describe("BoldToken", async (accounts) => {
      //    mint
      it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
        // Attempt call from alice
        const txAlice = boldToken.mint(bob, 100, { from: alice });
        await th.assertRevert(txAlice, "Caller is not BorrowerOperations");
      });

      // burn
      it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
        // Attempt call from alice
        try {
          const txAlice = await boldToken.burn(bob, 100, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
        }
      });

      // sendToPool
      it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
        // Attempt call from alice
        try {
          const txAlice = await boldToken.sendToPool(
            bob,
            activePool.address,
            100,
            { from: alice }
          );
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not the StabilityPool");
        }
      });

      // returnFromPool
      it("returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool", async () => {
        // Attempt call from alice
        try {
          const txAlice = await boldToken.returnFromPool(
            activePool.address,
            bob,
            100,
            { from: alice }
          );
        } catch (err) {
          assert.include(err.message, "revert");
          // assert.include(err.message, "Caller is neither TroveManager nor StabilityPool")
        }
      });
    });

    describe("SortedTroves", async (accounts) => {
      // --- onlyBorrowerOperations ---
      //     insert
      it("insert(): reverts when called by an account that is not BorrowerOps or TroveM", async () => {
        // Attempt call from alice
        try {
          const txAlice = await sortedTroves.insert(
            bob,
            "150000000000000000000",
            bob,
            bob,
            { from: alice }
          );
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, " Caller is not BorrowerOperations");
        }
      });

      // --- onlyTroveManager ---
      // remove
      it("remove(): reverts when called by an account that is not TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await sortedTroves.remove(bob, { from: alice });
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, " Caller is not the TroveManager");
        }
      });

      // --- onlyTroveMorBM ---
      // reinsert
      it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
        // Attempt call from alice
        try {
          const txAlice = await sortedTroves.reInsert(
            bob,
            "150000000000000000000",
            bob,
            bob,
            { from: alice }
          );
        } catch (err) {
          assert.include(err.message, "revert");
          assert.include(err.message, "Caller is not BorrowerOperations");
        }
      });
    });
  }
);
