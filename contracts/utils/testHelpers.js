const MoneyValues = {
  negative_5e17: "-" + web3.utils.toWei("500", "finney"),
  negative_1e18: "-" + web3.utils.toWei("1", "ether"),
  negative_10e18: "-" + web3.utils.toWei("10", "ether"),
  negative_50e18: "-" + web3.utils.toWei("50", "ether"),
  negative_100e18: "-" + web3.utils.toWei("100", "ether"),
  negative_101e18: "-" + web3.utils.toWei("101", "ether"),
  negative_eth: (amount) => "-" + web3.utils.toWei(amount, "ether"),

  _zeroBN: web3.utils.toBN("0"),
  _1e18BN: web3.utils.toBN("1000000000000000000"),
  _10e18BN: web3.utils.toBN("10000000000000000000"),
  _100e18BN: web3.utils.toBN("100000000000000000000"),
  _100BN: web3.utils.toBN("100"),
  _110BN: web3.utils.toBN("110"),
  _150BN: web3.utils.toBN("150"),

  _MCR: web3.utils.toBN("1100000000000000000"),
  _ICR100: web3.utils.toBN("1000000000000000000"),
  _CCR: web3.utils.toBN("1500000000000000000"),
};

const TimeValues = {
  SECONDS_IN_ONE_MINUTE: 60,
  SECONDS_IN_ONE_HOUR: 60 * 60,
  SECONDS_IN_ONE_DAY: 60 * 60 * 24,
  SECONDS_IN_ONE_WEEK: 60 * 60 * 24 * 7,
  SECONDS_IN_SIX_WEEKS: 60 * 60 * 24 * 7 * 6,
  SECONDS_IN_ONE_MONTH: 60 * 60 * 24 * 30,
  SECONDS_IN_ONE_YEAR: 60 * 60 * 24 * 365,
  MINUTES_IN_ONE_WEEK: 60 * 24 * 7,
  MINUTES_IN_ONE_MONTH: 60 * 24 * 30,
  MINUTES_IN_ONE_YEAR: 60 * 24 * 365,
};

class TestHelper {
  static dec(val, scale) {
    let zerosCount;

    if (scale == "ether") {
      zerosCount = 18;
    } else if (scale == "finney") zerosCount = 15;
    else {
      zerosCount = scale;
    }

    const strVal = val.toString();
    const strZeros = "0".repeat(zerosCount);

    return strVal.concat(strZeros);
  }

  static squeezeAddr(address) {
    const len = address.length;
    return address
      .slice(0, 6)
      .concat("...")
      .concat(address.slice(len - 4, len));
  }

  static getDifference(x, y) {
    const x_BN = web3.utils.toBN(x);
    const y_BN = web3.utils.toBN(y);

    return Number(x_BN.sub(y_BN).abs());
  }

  static assertIsApproximatelyEqual(x, y, error = 1000) {
    assert.isAtMost(this.getDifference(x, y), error);
  }

  static zipToObject(array1, array2) {
    let obj = {};
    array1.forEach((element, idx) => (obj[element] = array2[idx]));
    return obj;
  }

  static getGasMetrics(gasCostList) {
    const minGas = Math.min(...gasCostList);
    const maxGas = Math.max(...gasCostList);

    let sum = 0;
    for (const gas of gasCostList) {
      sum += gas;
    }

    if (sum === 0) {
      return {
        gasCostList: gasCostList,
        minGas: undefined,
        maxGas: undefined,
        meanGas: undefined,
        medianGas: undefined,
      };
    }
    const meanGas = sum / gasCostList.length;

    // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
    const sortedGasCostList = [...gasCostList].sort();
    const medianGas = sortedGasCostList[Math.floor(sortedGasCostList.length / 2)];
    return { gasCostList, minGas, maxGas, meanGas, medianGas };
  }

  static getGasMinMaxAvg(gasCostList) {
    const metrics = th.getGasMetrics(gasCostList);

    const minGas = metrics.minGas;
    const maxGas = metrics.maxGas;
    const meanGas = metrics.meanGas;
    const medianGas = metrics.medianGas;

    return { minGas, maxGas, meanGas, medianGas };
  }

  static getEndOfAccount(account) {
    const accountLast2bytes = account.slice(account.length - 4, account.length);
    return accountLast2bytes;
  }

  static randDecayFactor(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toFixed(18), "ether");
    return amountInWei;
  }

  static randAmountInWei(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toString(), "ether");
    return amountInWei;
  }

  static randAmountInGWei(min, max) {
    const amount = Math.floor(Math.random() * (max - min) + min);
    const amountInWei = web3.utils.toWei(amount.toString(), "gwei");
    return amountInWei;
  }

  static makeWei(num) {
    return web3.utils.toWei(num.toString(), "ether");
  }

  static appendData(results, message, data) {
    data.push(message + `\n`);
    for (const key in results) {
      data.push(key + "," + results[key] + "\n");
    }
  }

  static getRandICR(min, max) {
    const ICR_Percent = Math.floor(Math.random() * (max - min) + min);

    // Convert ICR to a duint
    const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), "finney");
    return ICR;
  }

  static computeICR(coll, debt, price) {
    const collBN = web3.utils.toBN(coll);
    const debtBN = web3.utils.toBN(debt);
    const priceBN = web3.utils.toBN(price);

    const ICR = debtBN.eq(this.toBN("0"))
      ? TestHelper.MAX_UINT256
      : collBN.mul(priceBN).div(debtBN);

    return ICR;
  }

  static addressToTroveId(address, index = 0) {
    return web3.utils.soliditySha3(web3.eth.abi.encodeParameters(["address", "uint256"], [address, index]));
  }

  static async ICRbetween100and110(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account, price);
    return ICR.gt(MoneyValues._ICR100) && ICR.lt(MoneyValues._MCR);
  }

  static async isUndercollateralized(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account, price);
    return ICR.lt(MoneyValues._MCR);
  }

  static toBN(num) {
    return web3.utils.toBN(num);
  }

  static gasUsed(tx) {
    const gas = tx.receipt.gasUsed;
    return gas;
  }

  static applyLiquidationFee(ethAmount) {
    if (ethAmount.mul(this.toBN(this.dec(5, 15))).div(MoneyValues._1e18BN).gt(this.toBN(this.dec(2,  18)))) {
      return ethAmount.sub(this.toBN(this.dec(2, 18)));
    }
    return ethAmount.mul(this.toBN(this.dec(995, 15))).div(MoneyValues._1e18BN);
  }
  // --- Logging functions ---

  static logGasMetrics(gasResults, message) {
    console.log(
      `\n ${message} \n
      min gas: ${gasResults.minGas} \n
      max gas: ${gasResults.maxGas} \n
      mean gas: ${gasResults.meanGas} \n
      median gas: ${gasResults.medianGas} \n`,
    );
  }

  static logAllGasCosts(gasResults) {
    console.log(`all gas costs: ${gasResults.gasCostList} \n`);
  }

  static logGas(gas, message) {
    console.log(
      `\n ${message} \n
      gas used: ${gas} \n`,
    );
  }

  static async logActiveAccounts(contracts, n) {
    const count = await contracts.sortedTroves.getSize();
    const price = await contracts.priceFeedTestnet.getPrice();

    n = typeof n == "undefined" ? count : n;

    let account = await contracts.sortedTroves.getLast();
    const head = await contracts.sortedTroves.getFirst();

    console.log(`Total active accounts: ${count}`);
    console.log(`First ${n} accounts, in ascending ICR order:`);

    let i = 0;
    while (i < n) {
      const squeezedAddr = this.squeezeAddr(account);
      const coll = (await contracts.troveManager.Troves(account))[1];
      const debt = (await contracts.troveManager.Troves(account))[0];
      const ICR = await contracts.troveManager.getCurrentICR(account, price);

      console.log(
        `Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`,
      );

      if (account == head) {
        break;
      }

      account = await contracts.sortedTroves.getPrev(account);

      i++;
    }
  }

  static async logAccountsArray(accounts, troveManager, price, n) {
    const length = accounts.length;

    n = typeof n == "undefined" ? length : n;

    console.log(`Number of accounts in array: ${length}`);
    console.log(`First ${n} accounts of array:`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      const squeezedAddr = this.squeezeAddr(account);
      const coll = (await troveManager.Troves(account))[1];
      const debt = (await troveManager.Troves(account))[0];
      const ICR = await troveManager.getCurrentICR(account, price);

      console.log(
        `Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`,
      );
    }
  }

  static logBN(label, x) {
    x = x.toString().padStart(18, "0");
    // TODO: thousand separators
    const integerPart = x.slice(0, x.length - 18)
      ? x.slice(0, x.length - 18)
      : "0";
    console.log(`${label}:`, integerPart + "." + x.slice(-18));
  }

  // --- TCR functions ---

  // These functions use the PriceFeedTestNet view price function getPrice() which is sufficient for testing.
  // the mainnet contract PriceFeed uses fetchPrice, which is non-view and writes to storage.

  // To checkBelowCriticalThreshold / getTCR from the Liquity mainnet contracts, pass a price value - this can be the lastGoodPrice
  // stored in Liquity, or the current Chainlink ETHUSD price, etc.

  static async checkBelowCriticalThreshold(contracts) {
    const price = await contracts.priceFeedTestnet.getPrice();
    return contracts.troveManager.checkBelowCriticalThreshold(price);
  }

  static async getTCR(contracts) {
    const price = await contracts.priceFeedTestnet.getPrice();
    return contracts.troveManager.getTCR(price);
  }

  // --- Gas compensation calculation functions ---

  // Given a composite debt, returns the actual debt  - i.e. subtracts the virtual debt.
  // Virtual debt = 50 Bold.
  static async getActualDebtFromComposite(compositeDebt, contracts) {
    return compositeDebt;
  }

  // Adds the gas compensation (50 Bold)
  static async getCompositeDebt(contracts, debt) {
    return debt;
  }

  static async getTroveEntireCollByAddress(contracts, account) {
    return await this.getTroveEntireColl(contracts, this.addressToTroveId(account));
  }

  static async getTroveEntireColl(contracts, trove) {
    return this.toBN(
      (await contracts.troveManager.getEntireDebtAndColl(trove))[1],
    );
  }

  static async getTroveEntireDebtByAddress(contracts, account) {
    return await this.getTroveEntireDebt(contracts, this.addressToTroveId(account));
  }

  static async getTroveEntireDebt(contracts, trove) {
    return this.toBN(
      (await contracts.troveManager.getEntireDebtAndColl(trove))[0],
    );
  }

  static async getTroveStake(contracts, trove) {
    return contracts.troveManager.getTroveStake(trove);
  }

  /*
   * given the requested Bold amomunt in openTrove, returns the total debt
   * So, it adds the gas compensation and the borrowing fee
   */
  static async getOpenTroveTotalDebt(contracts, boldAmount) {
    return (await this.getCompositeDebt(contracts, boldAmount));
  }

  /*
   * given the desired total debt, returns the Bold amount that needs to be requested in openTrove
   * So, it subtracts the gas compensation and then the borrowing fee
   */
  static async getOpenTroveBoldAmount(contracts, totalDebt) {
    const actualDebt = await this.getActualDebtFromComposite(
      totalDebt,
      contracts,
    );
    return this.getNetBorrowingAmount(contracts, actualDebt);
  }

  // Subtracts the borrowing fee
  // TODO: remove this, since we won't use the old borrow fee scheme
  static async getNetBorrowingAmount(contracts, debtWithFee) {
    return this.toBN(debtWithFee);
  }

  // Adds the borrowing fee
  // TODO: remove this, since we won't use the old borrow fee scheme
  static async getAmountWithBorrowingFee(contracts, boldAmount) {
    return boldAmount;
  }

  // Adds the redemption fee
  static async getRedemptionGrossAmount(contracts, expected) {
    const redemptionRate = await contracts.troveManager.getRedemptionRate();
    return expected
      .mul(MoneyValues._1e18BN)
      .div(MoneyValues._1e18BN.add(redemptionRate));
  }

  // Get's total collateral minus total gas comp, for a series of troves.
  static async getExpectedTotalCollMinusTotalGasComp(troveList, contracts) {
    let totalCollRemainder = web3.utils.toBN("0");

    for (const trove of troveList) {
      const remainingColl = this.getCollMinusGasComp(trove, contracts);
      totalCollRemainder = totalCollRemainder.add(remainingColl);
    }
    return totalCollRemainder;
  }

  static getEmittedRedemptionValues(redemptionTx) {
    for (let i = 0; i < redemptionTx.logs.length; i++) {
      if (redemptionTx.logs[i].event === "Redemption") {
        const BoldAmount = redemptionTx.logs[i].args[0];
        const totalBoldRedeemed = redemptionTx.logs[i].args[1];
        const totalCollDrawn = redemptionTx.logs[i].args[2];
        const collFee = redemptionTx.logs[i].args[3];

        return [BoldAmount, totalBoldRedeemed, totalCollDrawn, collFee];
      }
    }
    throw "The transaction logs do not contain a redemption event";
  }

  static getEmittedLiquidationValues(liquidationTx) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        const collSentToSP = liquidationTx.logs[i].args._collSentToSP;
        const collRedistributed = liquidationTx.logs[i].args._collRedistributed;
        const collGasComp = liquidationTx.logs[i].args._collGasCompensation;
        const debtOffsetBySP = liquidationTx.logs[i].args._debtOffsetBySP;
        const debtRedistributed = liquidationTx.logs[i].args._debtRedistributed;
        const boldGasComp = liquidationTx.logs[i].args._boldGasCompensation;

        const liquidatedColl = collSentToSP.add(collRedistributed);
        const liquidatedDebt = debtOffsetBySP.add(debtRedistributed);

        return [liquidatedDebt, liquidatedColl, collGasComp, boldGasComp];
      }
    }
    throw "The transaction logs do not contain a liquidation event";
  }

  static getEmittedLiquidatedDebt(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 0); // LiquidatedDebt is position 0 in the Liquidation event
  }

  static getEmittedLiquidatedColl(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 1); // LiquidatedColl is position 1 in the Liquidation event
  }

  static getEmittedGasComp(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 2); // GasComp is position 2 in the Liquidation event
  }

  static getLiquidationEventArg(liquidationTx, arg) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        return liquidationTx.logs[i].args[arg];
      }
    }

    throw "The transaction logs do not contain a liquidation event";
  }

  static getBoldFeeFromBoldBorrowingEvent(tx) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === "BoldBorrowingFeePaid") {
        return tx.logs[i].args[1].toString();
      }
    }
    throw "The transaction logs do not contain an BoldBorrowingFeePaid event";
  }

  static getEventArgByIndex(tx, eventName, argIndex) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        return tx.logs[i].args[argIndex];
      }
    }
    throw `The transaction logs do not contain event ${eventName}`;
  }

  static getEventBySignature(tx, eventSignature) {
    for (let i = 0; i < tx.receipt.rawLogs.length; i++) {
      if (tx.receipt.rawLogs[i].topics[0] === web3.utils.keccak256(eventSignature)) {
        return tx.receipt.rawLogs[i];
      }
    }

    throw `The transaction logs do not contain event with signature "${eventSignature}"`;
  }

  static getAllEventsByName(tx, eventName) {
    const events = [];
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        events.push(tx.logs[i]);
      }
    }
    return events;
  }

  static getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, address) {
    const event = troveUpdatedEvents.filter(
      (event) => event.args[0] === address,
    )[0];
    return [event.args[1], event.args[2]];
  }

  static async getBorrowerOpsListHint(contracts, newColl, newDebt) {
    const newNICR = await contracts.hintHelpers.computeNominalCR(
      newColl,
      newDebt,
    );
    const { hintAddress: approxfullListHint, latestRandomSeed } = await contracts.hintHelpers.getApproxHint(
      0,
      newNICR,
      5,
      this.latestRandomSeed,
    );
    this.latestRandomSeed = latestRandomSeed;

    const { 0: upperHint, 1: lowerHint } = await contracts.sortedTroves.findInsertPosition(
      newNICR,
      approxfullListHint,
      approxfullListHint,
    );
    return { upperHint, lowerHint };
  }

  static async getEntireCollAndDebtByAddress(contracts, account) {
    return await this.getEntireCollAndDebt(contracts, this.addressToTroveId(account));
  }

  static async getEntireCollAndDebt(contracts, troveId) {
    // console.log(`troveId: ${troveId}`)
    const rawColl = (await contracts.troveManager.Troves(troveId))[1];
    const rawDebt = (await contracts.troveManager.Troves(troveId))[0];
    const pendingCollReward = await contracts.troveManager.getPendingCollReward(
      troveId,
    );
    const pendingBoldDebtReward = await contracts.troveManager.getPendingBoldDebtReward(troveId);
    const entireColl = rawColl.add(pendingCollReward);
    const entireDebt = rawDebt.add(pendingBoldDebtReward);

    return { entireColl, entireDebt };
  }

  static async getCollAndDebtFromAddColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(
      contracts,
      account,
    );

    const newColl = entireColl.add(this.toBN(amount));
    const newDebt = entireDebt;
    return { newColl, newDebt };
  }

  static async getCollAndDebtFromWithdrawColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(
      contracts,
      account,
    );
    // console.log(`entireColl  ${entireColl}`)
    // console.log(`entireDebt  ${entireDebt}`)

    const newColl = entireColl.sub(this.toBN(amount));
    const newDebt = entireDebt;
    return { newColl, newDebt };
  }

  static async getCollAndDebtFromWithdrawBold(contracts, account, amount) {
    const fee = await contracts.troveManager.getBorrowingFee(amount);
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(
      contracts,
      account,
    );

    const newColl = entireColl;
    const newDebt = entireDebt.add(this.toBN(amount)).add(fee);

    return { newColl, newDebt };
  }

  static async getCollAndDebtFromRepayBold(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(
      contracts,
      account,
    );

    const newColl = entireColl;
    const newDebt = entireDebt.sub(this.toBN(amount));

    return { newColl, newDebt };
  }

  static async getCollAndDebtFromAdjustment(
    contracts,
    account,
    collChange,
    BoldChange,
  ) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(
      contracts,
      account,
    );

    // const coll = (await contracts.troveManager.Troves(account))[1]
    // const debt = (await contracts.troveManager.Troves(account))[0]

    const fee = BoldChange.gt(this.toBN("0"))
      ? await contracts.troveManager.getBorrowingFee(BoldChange)
      : this.toBN("0");
    const newColl = entireColl.add(collChange);
    const newDebt = entireDebt.add(BoldChange).add(fee);

    return { newColl, newDebt };
  }

  // --- BorrowerOperations gas functions ---

  static async openTrove_allAccounts(
    accounts,
    contracts,
    collAmount,
    BoldAmount,
  ) {
    const gasCostList = [];
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, BoldAmount);

    for (const account of accounts) {
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        collAmount,
        totalDebt,
      );

      const tx = await contracts.borrowerOperations.openTrove(
        this._100pct,
        collAmount,
        BoldAmount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async openTrove_allAccounts_randomETH(
    minETH,
    maxETH,
    accounts,
    contracts,
    BoldAmount,
  ) {
    const gasCostList = [];
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, BoldAmount);

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH);
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        randCollAmount,
        totalDebt,
      );

      const tx = await contracts.borrowerOperations.openTrove(
        this._100pct,
        randCollAmount,
        BoldAmount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async openTrove_allAccounts_randomETH_ProportionalBold(
    minETH,
    maxETH,
    accounts,
    contracts,
    proportion,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH);
      const proportionalBold = web3.utils
        .toBN(proportion)
        .mul(web3.utils.toBN(randCollAmount));
      const totalDebt = await this.getOpenTroveTotalDebt(
        contracts,
        proportionalBold,
      );

      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        randCollAmount,
        totalDebt,
      );

      const tx = await contracts.borrowerOperations.openTrove(
        this._100pct,
        randCollAmount,
        proportionalBold,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async openTrove_allAccounts_randomETH_randomBold(
    minETH,
    maxETH,
    accounts,
    contracts,
    minBoldProportion,
    maxBoldProportion,
    logging = false,
  ) {
    const gasCostList = [];
    const price = await contracts.priceFeedTestnet.getPrice();
    const _1e18 = web3.utils.toBN("1000000000000000000");

    let i = 0;
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH);
      // console.log(`randCollAmount ${randCollAmount }`)
      const randBoldProportion = this.randAmountInWei(
        minBoldProportion,
        maxBoldProportion,
      );
      const proportionalBold = web3.utils
        .toBN(randBoldProportion)
        .mul(web3.utils.toBN(randCollAmount).div(_1e18));
      const totalDebt = await this.getOpenTroveTotalDebt(
        contracts,
        proportionalBold,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        randCollAmount,
        totalDebt,
      );

      const feeFloor = this.dec(5, 16);
      const tx = await contracts.borrowerOperations.openTrove(
        this._100pct,
        randCollAmount,
        proportionalBold,
        upperHint,
        lowerHint,
        { from: account },
      );

      if (logging && tx.receipt.status) {
        i++;
        const ICR = await contracts.troveManager.getCurrentICR(account, price);
        // console.log(`${i}. Trove opened. addr: ${this.squeezeAddr(account)} coll: ${randCollAmount} debt: ${proportionalBold} ICR: ${ICR}`)
      }
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async openTrove_allAccounts_randomBold(
    minBold,
    maxBold,
    accounts,
    contracts,
    collAmount,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      const randBoldAmount = this.randAmountInWei(minBold, maxBold);
      const totalDebt = await this.getOpenTroveTotalDebt(
        contracts,
        randBoldAmount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        collAmount,
        totalDebt,
      );

      const tx = await contracts.borrowerOperations.openTrove(
        this._100pct,
        collAmount,
        randBoldAmount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async closeTrove_allAccounts(accounts, contracts) {
    const gasCostList = [];

    for (const account of accounts) {
      const tx = await contracts.borrowerOperations.closeTrove({
        from: account,
      });
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async openTrove(
    contracts,
    {
      troveIndex,
      extraBoldAmount,
      upperHint,
      lowerHint,
      ICR,
      extraParams,
    },
  ) {
    if (!troveIndex) troveIndex = 0;
    if (!extraBoldAmount) extraBoldAmount = this.toBN(0);
    else if (typeof extraBoldAmount == "string") {
      extraBoldAmount = this.toBN(extraBoldAmount);
    }
    if (!extraParams.annualInterestRate) {
      if (extraParams.batchManager) {
        extraParams.annualInterestRate = await contracts.troveManager.getBatchAnnualInterestRate(extraParams.batchManager);
      } else {
        extraParams.annualInterestRate = 0;
      }
    }
    if (!upperHint) upperHint = this.ZERO_ADDRESS;
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS;

    const MIN_DEBT = await this.getNetBorrowingAmount(
      contracts,
      await contracts.constants._MIN_DEBT(),
    );

    // Only needed for non-zero borrow fee: .add(this.toBN(1)); // add 1 to avoid rounding issues

    const boldAmount = MIN_DEBT.add(extraBoldAmount);
    const predictedUpfrontFee = await contracts.troveManager.predictOpenTroveUpfrontFee(boldAmount, extraParams.annualInterestRate);
    const predictedBoldAmount = boldAmount.add(predictedUpfrontFee);

    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(15, 17)); // 150%
    else if (typeof ICR == "string") ICR = this.toBN(ICR);

    const predictedTotalDebt = await this.getOpenTroveTotalDebt(contracts, predictedBoldAmount);

    if (ICR) {
      const price = await contracts.priceFeedTestnet.getPrice();
      extraParams.value = ICR.mul(predictedTotalDebt).div(price);
    }

    // approve ERC20 ETH
    const ETH_GAS_COMPENSATION = await contracts.constants._ETH_GAS_COMPENSATION();
    await contracts.WETH.approve(contracts.borrowerOperations.address, this.toBN(extraParams.value).add(ETH_GAS_COMPENSATION), { from: extraParams.from });

    let tx;
    if (extraParams.batchManager) {
      tx = await contracts.borrowerOperations.openTroveAndJoinInterestBatchManager(
        extraParams.from,
        troveIndex,
        extraParams.value,
        boldAmount,
        upperHint,
        lowerHint,
        extraParams.batchManager,
        TestHelper.MAX_UINT256, // _maxUpfrontFee
        { from: extraParams.from },
      );
    } else {
      tx = await contracts.borrowerOperations.openTrove(
        extraParams.from,
        troveIndex,
        extraParams.value,
        boldAmount,
        upperHint,
        lowerHint,
        extraParams.annualInterestRate,
        TestHelper.MAX_UINT256, // _maxUpfrontFee
        { from: extraParams.from },
      );
    }

    const troveId = this.getTroveIdFromTx(tx, contracts);

    const realTotalDebt = await contracts.troveManager.getTroveEntireDebt(troveId);
    const netDebt = await this.getActualDebtFromComposite(realTotalDebt, contracts);

    return {
      troveId,
      boldAmount,
      netDebt,
      totalDebt: realTotalDebt,
      ICR,
      collateral: extraParams.value,
      tx,
    };
  }

  static async openTroveWrapper(
    contracts,
    boldAmount,
    upperHint,
    lowerHint,
    annualInterestRate,
    extraParams,
  ) {
    // approve ERC20 ETH
    const ETH_GAS_COMPENSATION = await contracts.constants._ETH_GAS_COMPENSATION();
    await contracts.WETH.approve(contracts.borrowerOperations.address, this.toBN(extraParams.value).add(ETH_GAS_COMPENSATION), { from: extraParams.from });

    let tx;
    if (extraParams.batchManager) {
      /*
      if (annualInterestRate != 0) {
        await contracts.borrowerOperations.setBatchManagerAnnualInterestRate(extraParams.annualInterestRate, 0, 0, TestHelper.MAX_UINT256, { from: extraParams.batchManager });
      }
      */
      tx = await contracts.borrowerOperations.openTroveAndJoinInterestBatchManager(
        extraParams.from,
        0,
        extraParams.value,
        boldAmount,
        upperHint,
        lowerHint,
        extraParams.batchManager,
        TestHelper.MAX_UINT256, // _maxUpfrontFee
        { from: extraParams.from },
      );
    } else {
      tx = await contracts.borrowerOperations.openTrove(
        extraParams.from,
        0,
        extraParams.value,
        boldAmount,
        upperHint,
        lowerHint,
        annualInterestRate,
        TestHelper.MAX_UINT256, // _maxUpfrontFee
        { from: extraParams.from },
      );
    }

    const troveId = this.getTroveIdFromTx(tx, contracts);

    return troveId;
  }

  static getTroveIdFromTx(tx, contracts) {
    for (let i = 0; i < tx.receipt.rawLogs.length; i++) {
      if (
        tx.receipt.rawLogs[i].address === contracts.troveNFT.address
        && tx.receipt.rawLogs[i].topics[0] === web3.utils.keccak256("Transfer(address,address,uint256)")
        && tx.receipt.rawLogs[i].topics[1] === this.ZERO_UINT256 // mint
      ) {
        const troveId = tx.receipt.rawLogs[i].topics[3];

        return this.toBN(troveId);
      }
    }
    // throw "The transaction logs do not contain a trove creation event";
    throw JSON.stringify(tx.receipt.rawLogs);
  }

  static async withdrawBold(
    contracts,
    { troveId, boldAmount, ICR, extraParams },
  ) {
    if (!troveId) troveId = this.addressToTroveId(extraParams.from);

    assert(
      !(boldAmount && ICR) && (boldAmount || ICR),
      "Specify either bold amount or target ICR, but not both",
    );

    let increasedTotalDebt;
    if (ICR) {
      assert(extraParams.from, "A from account is needed");
      const { entireDebt, entireColl } = await contracts.troveManager.getEntireDebtAndColl(troveId);
      const price = await contracts.priceFeedTestnet.getPrice();
      const targetDebt = entireColl.mul(price).div(ICR);
      assert(
        targetDebt > entireDebt,
        "ICR is already greater than or equal to target",
      );
      increasedTotalDebt = targetDebt.sub(entireDebt);
      const annualInterestRate = await contracts.troveManager.getTroveAnnualInterestRate(troveId);
      const predictedUpfrontFee = await contracts.troveManager.predictOpenTroveUpfrontFee(increasedTotalDebt, annualInterestRate);
      increasedTotalDebt = increasedTotalDebt.sub(predictedUpfrontFee);
      boldAmount = await this.getNetBorrowingAmount(
        contracts,
        increasedTotalDebt,
      );
    } else {
      increasedTotalDebt = await this.getAmountWithBorrowingFee(
        contracts,
        boldAmount,
      );
    }

    await contracts.borrowerOperations.withdrawBold(
      troveId,
      boldAmount,
      TestHelper.MAX_UINT256,
      extraParams,
    );

    return {
      boldAmount,
      increasedTotalDebt,
    };
  }

  static async adjustTrove_allAccounts(
    accounts,
    contracts,
    collAmount,
    BoldAmount,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      let tx;

      let collChangeBN = this.toBN(collAmount);
      let BoldChangeBN = this.toBN(BoldAmount);

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(
        contracts,
        account,
        collChangeBN,
        BoldChangeBN,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const zero = this.toBN("0");

      let isDebtIncrease = BoldChangeBN.gt(zero);
      BoldChangeBN = BoldChangeBN.abs();

      // Add ETH to trove
      if (collChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustTrove(
          this._100pct,
          collChangeBN,
          true,
          BoldChangeBN,
          isDebtIncrease,
          upperHint,
          lowerHint,
          { from: account },
        );
        // Withdraw ETH from trove
      } else if (collChangeBN.lt(zero)) {
        collChangeBN = collChangeBN.neg();
        tx = await contracts.borrowerOperations.adjustTrove(
          this._100pct,
          collChangeBN,
          false,
          BoldChangeBN,
          isDebtIncrease,
          upperHint,
          lowerHint,
          { from: account },
        );
      }

      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async adjustTrove_allAccounts_randomAmount(
    accounts,
    contracts,
    ETHMin,
    ETHMax,
    BoldMin,
    BoldMax,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      let tx;

      let collChangeBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax));
      let BoldChangeBN = this.toBN(this.randAmountInWei(BoldMin, BoldMax));

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(
        contracts,
        account,
        collChangeBN,
        BoldChangeBN,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const zero = this.toBN("0");

      let isDebtIncrease = BoldChangeBN.gt(zero);
      BoldChangeBN = BoldChangeBN.abs();

      // Add ETH to trove
      if (collChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustTrove(
          this._100pct,
          collChangeBN,
          true,
          BoldChangeBN,
          isDebtIncrease,
          upperHint,
          lowerHint,
          { from: account },
        );
        // Withdraw ETH from trove
      } else if (collChangeBN.lt(zero)) {
        collChangeBN = collChangeBN.neg();
        tx = await contracts.borrowerOperations.adjustTrove(
          this._100pct,
          collChangeBN,
          false,
          BoldChangeBN,
          isDebtIncrease,
          lowerHint,
          upperHint,
          { from: account },
        );
      }

      const gas = this.gasUsed(tx);
      // console.log(`ETH change: ${collChangeBN},  BoldChange: ${BoldChangeBN}, gas: ${gas} `)

      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async addColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = [];
    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(
        contracts,
        account,
        amount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.addColl(
        upperHint,
        lowerHint,
        { from: account, value: amount },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async addColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = [];
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max);

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(
        contracts,
        account,
        randCollAmount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.addColl(
        upperHint,
        lowerHint,
        { from: account, value: randCollAmount },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async addCollWrapper(
    contracts,
    extraParams,
  ) {
    // approve ERC20 ETH
    await contracts.WETH.approve(contracts.borrowerOperations.address, extraParams.value, { from: extraParams.from });

    const troveId = this.addressToTroveId(extraParams.from);

    const tx = await contracts.borrowerOperations.addColl(
      troveId,
      extraParams.value,
      {
        from: extraParams.from,
      },
    );
    return tx;
  }

  static async withdrawColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = [];
    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(
        contracts,
        account,
        amount,
      );
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.withdrawColl(
        amount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async withdrawColl_allAccounts_randomAmount(
    min,
    max,
    accounts,
    contracts,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max);

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(
        contracts,
        account,
        randCollAmount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.withdrawColl(
        randCollAmount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList);
  }

  static async withdrawBold_allAccounts(accounts, contracts, amount) {
    const gasCostList = [];

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawBold(
        contracts,
        account,
        amount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.withdrawBold(
        this._100pct,
        amount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async withdrawBold_allAccounts_randomAmount(
    min,
    max,
    accounts,
    contracts,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      const randBoldAmount = this.randAmountInWei(min, max);

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawBold(
        contracts,
        account,
        randBoldAmount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.withdrawBold(
        this._100pct,
        randBoldAmount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async repayBold_allAccounts(accounts, contracts, amount) {
    const gasCostList = [];

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromRepayBold(
        contracts,
        account,
        amount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.repayBold(
        amount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async repayBold_allAccounts_randomAmount(
    min,
    max,
    accounts,
    contracts,
  ) {
    const gasCostList = [];

    for (const account of accounts) {
      const randBoldAmount = this.randAmountInWei(min, max);

      const { newColl, newDebt } = await this.getCollAndDebtFromRepayBold(
        contracts,
        account,
        randBoldAmount,
      );
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        newDebt,
      );

      const tx = await contracts.borrowerOperations.repayBold(
        randBoldAmount,
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async getCurrentICR_allAccounts(accounts, contracts, functionCaller) {
    const gasCostList = [];
    const price = await contracts.priceFeedTestnet.getPrice();

    for (const account of accounts) {
      const tx = await functionCaller.troveManager_getCurrentICR(
        account,
        price,
      );
      const gas = this.gasUsed(tx) - 21000;
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  // --- Redemption functions ---

  static async redeemCollateral(
    redeemer,
    contracts,
    BoldAmount,
    maxFee = this._100pct,
    gasPrice = 10,
  ) {
    const price = await contracts.priceFeedTestnet.getPrice();
    const tx = await this.performRedemptionTx(
      redeemer,
      price,
      contracts,
      BoldAmount,
      10,
      maxFee,
      gasPrice,
    );
    const gas = await this.gasUsed(tx);
    return gas;
  }

  static async redeemCollateralAndGetTxObject(
    redeemer,
    contracts,
    BoldAmount,
    maxIterations = 10,
    maxFee = this._100pct,
    gasPrice,
  ) {
    // console.log("GAS PRICE:  " + gasPrice)
    if (gasPrice == undefined) {
      gasPrice = 10;
    }
    const price = await contracts.priceFeedTestnet.getPrice();
    const tx = await this.performRedemptionTx(
      redeemer,
      price,
      contracts,
      BoldAmount,
      maxIterations,
      maxFee,
      gasPrice,
    );
    return tx;
  }

  static async redeemCollateral_allAccounts_randomAmount(
    min,
    max,
    accounts,
    contracts,
  ) {
    const gasCostList = [];
    const price = await contracts.priceFeedTestnet.getPrice();

    for (const redeemer of accounts) {
      const randBoldAmount = this.randAmountInWei(min, max);

      await this.performRedemptionTx(
        redeemer,
        price,
        contracts,
        randBoldAmount,
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async performRedemptionTx(
    redeemer,
    price,
    contracts,
    BoldAmount,
    maxIterations = 10,
    maxFee = 0,
    gasPrice_toUse = 0,
  ) {
    const tx = await contracts.collateralRegistry.redeemCollateral(
      BoldAmount,
      maxIterations,
      maxFee,
      { from: redeemer, gasPrice: gasPrice_toUse },
    );

    return tx;
  }

  // --- Composite functions ---

  static async makeTrovesIncreasingICR(accounts, contracts) {
    let amountFinney = 2000;

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), "finney");

      await contracts.borrowerOperations.openTrove(
        this._100pct,
        coll,
        "200000000000000000000",
        account,
        account,
        { from: account },
      );

      amountFinney += 10;
    }
  }

  // --- StabilityPool functions ---

  static async provideToSPAndClaim(contracts, amount, extraParams) {
    const tx = await contracts.stabilityPool.provideToSP(amount, true, { from: extraParams.from });

    return tx;
  }

  static async withdrawFromSPAndClaim(contracts, amount, extraParams) {
    const tx = await contracts.stabilityPool.withdrawFromSP(amount, true, { from: extraParams.from });

    return tx;
  }

  static async provideToSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = [];
    for (const account of accounts) {
      const tx = await stabilityPool.provideToSP(amount, this.ZERO_ADDRESS, {
        from: account,
      });
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async provideToSP_allAccounts_randomAmount(
    min,
    max,
    accounts,
    stabilityPool,
  ) {
    const gasCostList = [];
    for (const account of accounts) {
      const randomBoldAmount = this.randAmountInWei(min, max);
      const tx = await stabilityPool.provideToSP(
        randomBoldAmount,
        this.ZERO_ADDRESS,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async withdrawFromSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = [];
    for (const account of accounts) {
      const tx = await stabilityPool.withdrawFromSP(amount, { from: account });
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async withdrawFromSP_allAccounts_randomAmount(
    min,
    max,
    accounts,
    stabilityPool,
  ) {
    const gasCostList = [];
    for (const account of accounts) {
      const randomBoldAmount = this.randAmountInWei(min, max);
      const tx = await stabilityPool.withdrawFromSP(randomBoldAmount, {
        from: account,
      });
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  static async withdrawETHGainToTrove_allAccounts(accounts, contracts) {
    const gasCostList = [];
    for (const account of accounts) {
      let { entireColl, entireDebt } = await this.getEntireCollAndDebt(
        contracts,
        account,
      );
      console.log(`entireColl: ${entireColl}`);
      console.log(`entireDebt: ${entireDebt}`);
      const ETHGain = await contracts.stabilityPool.getDepositorETHGain(
        account,
      );
      const newColl = entireColl.add(ETHGain);
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(
        contracts,
        newColl,
        entireDebt,
      );

      const tx = await contracts.stabilityPool.withdrawETHGainToTrove(
        upperHint,
        lowerHint,
        { from: account },
      );
      const gas = this.gasUsed(tx);
      gasCostList.push(gas);
    }
    return this.getGasMetrics(gasCostList);
  }

  // --- LQTY & Lockup Contract functions ---

  static async registerFrontEnds(frontEnds, stabilityPool) {
    for (const frontEnd of frontEnds) {
      await stabilityPool.registerFrontEnd(this.dec(5, 17), { from: frontEnd }); // default kickback rate of 50%
    }
  }

  // --- Time functions ---

  static async getLatestBlockTimestamp(web3Instance) {
    const blockNumber = await web3Instance.eth.getBlockNumber();
    const block = await web3Instance.eth.getBlock(blockNumber);

    return block.timestamp;
  }

  static async getTimestampFromTx(tx, web3Instance) {
    return this.getTimestampFromTxReceipt(tx.receipt, web3Instance);
  }

  static async getTimestampFromTxReceipt(txReceipt, web3Instance) {
    const block = await web3Instance.eth.getBlock(txReceipt.blockNumber);
    return block.timestamp;
  }

  static secondsToDays(seconds) {
    return Number(seconds) / (60 * 60 * 24);
  }

  static daysToSeconds(days) {
    return Number(days) * (60 * 60 * 24);
  }

  static async getTimeFromSystemDeployment(
    lqtyToken,
    web3,
    timePassedSinceDeployment,
  ) {
    const deploymentTime = await lqtyToken.getDeploymentStartTime();
    return this.toBN(deploymentTime).add(this.toBN(timePassedSinceDeployment));
  }

  // --- Assert functions ---

  static async assertRevert(txPromise, message = undefined) {
    try {
      const tx = await txPromise;
      // console.log("tx succeeded")
      assert.isFalse(tx.receipt.status); // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      // console.log("tx failed")
      assert.include(err.message, "revert");
      // TODO !!!

      // if (message) {
      //   assert.include(err.message, message)
      // }
    }
  }

  static async assertAssert(txPromise) {
    try {
      const tx = await txPromise;
      assert.isFalse(tx.receipt.status); // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      assert.include(err.message, "invalid opcode");
    }
  }

  // --- Misc. functions  ---

  static hexToParam(hexValue) {
    return ("0".repeat(64) + hexValue.slice(2)).slice(-64);
  }

  static formatParam(param) {
    let formattedParam = param;
    if (
      typeof param == "number"
      || typeof param == "object"
      || (typeof param == "string" && new RegExp("[0-9]*").test(param))
    ) {
      formattedParam = web3.utils.toHex(formattedParam);
    } else if (typeof param == "boolean") {
      formattedParam = param ? "0x01" : "0x00";
    } else if (param.slice(0, 2) != "0x") {
      formattedParam = web3.utils.asciiToHex(formattedParam);
    }

    return this.hexToParam(formattedParam);
  }
  static getTransactionData(signatureString, params) {
    /*
     console.log('signatureString: ', signatureString)
     console.log('params: ', params)
     console.log('params: ', params.map(p => typeof p))
     */
    return (
      web3.utils.sha3(signatureString).slice(0, 10)
      + params.reduce((acc, p) => acc + this.formatParam(p), "")
    );
  }
}

TestHelper.MAX_UINT256 = web3.utils.toBN("0x" + "f".repeat(64));
TestHelper.ZERO_ADDRESS = "0x" + "0".repeat(40);
TestHelper.ZERO_UINT256 = "0x" + "0".repeat(64);
TestHelper._100pct = "1000000000000000000";
TestHelper.latestRandomSeed = 31337;

module.exports = {
  TestHelper,
  MoneyValues,
  TimeValues,
};
