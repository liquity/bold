const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayableSwitch = artifacts.require("./NonPayableSwitch.sol")
const ERC20 = artifacts.require("./ERC20MinterMock.sol");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { TestHelper: th } = require("../utils/testHelpers.js")

const { dec } = th

const _minus_1_Ether = web3.utils.toWei('-1', 'ether')

contract('StabilityPool', async accounts => {

  const [owner, alice] = accounts;

  const deployFixture = async () => {
    /* mock* are EOA’s, temporarily used to call protected functions.
    TODO: Replace with mock contracts, and later complete transactions from EOA
    */
    const WETH = await ERC20.new("WETH", "WETH");
    const stabilityPool = await StabilityPool.new(WETH.address)
    const { address: mockActivePoolAddress } = await NonPayableSwitch.new()
    const { address: dumbContractAddress } = await NonPayableSwitch.new()
    await stabilityPool.setAddresses(dumbContractAddress, dumbContractAddress, mockActivePoolAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress)

    return stabilityPool
  }

  it('getETHBalance(): gets the recorded ETH balance', async () => {
    const stabilityPool = await loadFixture(deployFixture)
    const recordedETHBalance = await stabilityPool.getETHBalance()
    assert.equal(recordedETHBalance, 0)
  })

  it('getTotalBoldDeposits(): gets the recorded BOLD balance', async () => {
    const stabilityPool = await loadFixture(deployFixture)
    const recordedETHBalance = await stabilityPool.getTotalBoldDeposits()
    assert.equal(recordedETHBalance, 0)
  })
})

contract('ActivePool', async accounts => {

  let activePool, mockBorrowerOperations, mockTroveManager, WETH

  const [owner, alice] = accounts;

  const deployFixture = async () => {
    const WETH = await ERC20.new("WETH", "WETH");
    const activePool = await ActivePool.new(WETH.address)
    const mockBorrowerOperations = await NonPayableSwitch.new()
    const mockTroveManager = await NonPayableSwitch.new()
    const { address: dumbContractAddress } = await NonPayableSwitch.new()
    await activePool.setAddresses(mockBorrowerOperations.address, mockTroveManager.address, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress)

    return { activePool, mockBorrowerOperations, mockTroveManager, WETH }
  }

  beforeEach(async () => {
    const result = await loadFixture(deployFixture)
    WETH = result.WETH
    activePool = result.activePool
    mockBorrowerOperations = result.mockBorrowerOperations
    mockTroveManager = result.mockTroveManager
  })

  it('getETHBalance(): gets the recorded ETH balance', async () => {
    const recordedETHBalance = await activePool.getETHBalance()
    assert.equal(recordedETHBalance, 0)
  })

  it('getBoldDebt(): gets the recorded BOLD balance', async () => {
    const recordedETHBalance = await activePool.getRecordedDebtSum()
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseRecordedDebtSum(): increases the recorded BOLD balance by the correct amount', async () => {
    const recordedBold_balanceBefore = await activePool.getRecordedDebtSum()
    assert.equal(recordedBold_balanceBefore, 0)

    // await activePool.increaseBoldDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseBoldDebtData = th.getTransactionData('increaseRecordedDebtSum(uint256)', ['0x64'])
    const tx = await mockTroveManager.forward(activePool.address, increaseBoldDebtData)
    assert.isTrue(tx.receipt.status)
    const recordedBold_balanceAfter = await activePool.getRecordedDebtSum()
    assert.equal(recordedBold_balanceAfter, 100)
  })
  // Decrease
  it('decreaseRecordedDebtSum(): decreases the recorded BOLD balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await activePool.increaseBoldDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseBoldDebtData = th.getTransactionData('increaseRecordedDebtSum(uint256)', ['0x64'])
    const tx1 = await mockTroveManager.forward(activePool.address, increaseBoldDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedBold_balanceBefore = await activePool.getRecordedDebtSum()
    assert.equal(recordedBold_balanceBefore, 100)

    //await activePool.decreaseBoldDebt(100, { from: mockBorrowerOperationsAddress })
    const decreaseBoldDebtData = th.getTransactionData('decreaseRecordedDebtSum(uint256)', ['0x64'])
    const tx2 = await mockTroveManager.forward(activePool.address, decreaseBoldDebtData)
    assert.isTrue(tx2.receipt.status)
    const recordedBold_balanceAfter = await activePool.getRecordedDebtSum()
    assert.equal(recordedBold_balanceAfter, 0)
  })

  // send raw ether
  it('sendETH(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const activePool_initialBalance = web3.utils.toBN(await WETH.balanceOf(activePool.address))
    assert.equal(activePool_initialBalance, 0)
    // start pool with 2 ether
    //await web3.eth.sendTransaction({ from: mockBorrowerOperationsAddress, to: activePool.address, value: dec(2, 'ether') })
    const eth_amount = dec(2, 'ether');
    await WETH.mint(mockBorrowerOperations.address, eth_amount);
    // approve
    const approveData = th.getTransactionData('approve(address,uint256)', [activePool.address, web3.utils.toHex(eth_amount)]);
    await mockBorrowerOperations.forward(WETH.address, approveData, { from: owner });
    // call receiveETH
    const receiveETHData = th.getTransactionData('receiveETH(uint256)', [web3.utils.toHex(eth_amount)]);
    const tx1 = await mockBorrowerOperations.forward(activePool.address, receiveETHData, { from: owner });
    assert.isTrue(tx1.receipt.status)

    const activePool_BalanceBeforeTx = web3.utils.toBN(await WETH.balanceOf(activePool.address))
    const alice_Balance_BeforeTx = web3.utils.toBN(await WETH.balanceOf(alice))

    assert.equal(activePool_BalanceBeforeTx, dec(2, 'ether'))

    // send ether from pool to alice
    // th.logBN("eth bal", await WETH.balanceOf(activePool.address))
    //await activePool.sendETH(alice, dec(1, 'ether'), { from: mockBorrowerOperationsAddress })
    const sendETHData = th.getTransactionData('sendETH(address,uint256)', [alice, web3.utils.toHex(dec(1, 'ether'))])
    const tx2 = await mockBorrowerOperations.forward(activePool.address, sendETHData, { from: owner })
    assert.isTrue(tx2.receipt.status)

    const activePool_BalanceAfterTx = web3.utils.toBN(await WETH.balanceOf(activePool.address))
    const alice_Balance_AfterTx = web3.utils.toBN(await WETH.balanceOf(alice))

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = activePool_BalanceAfterTx.sub(activePool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, dec(1, 'ether'))
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('DefaultPool', async accounts => {
 
   let defaultPool, mockTroveManager, mockActivePool, WETH

  const [owner, alice] = accounts;

  const deployFixture = async () => {
    const WETH = await ERC20.new("WETH", "WETH");
    const defaultPool = await DefaultPool.new(WETH.address)
    const mockTroveManager = await NonPayableSwitch.new()
    const mockActivePool = await NonPayableSwitch.new()
    await mockActivePool.setETH(WETH.address)
    await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address)

    return { defaultPool, mockTroveManager, mockActivePool, WETH }
  }

  beforeEach(async () => {
    const result = await loadFixture(deployFixture)
    WETH = result.WETH
    defaultPool = result.defaultPool
    mockTroveManager = result.mockTroveManager
    mockActivePool = result.mockActivePool
  })

  it('getETHBalance(): gets the recorded BOLD balance', async () => {
    const recordedETHBalance = await defaultPool.getETHBalance()
    assert.equal(recordedETHBalance, 0)
  })

  it('getBoldDebt(): gets the recorded BOLD balance', async () => {
    const recordedETHBalance = await defaultPool.getBoldDebt()
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseBold(): increases the recorded BOLD balance by the correct amount', async () => {
    const recordedBold_balanceBefore = await defaultPool.getBoldDebt()
    assert.equal(recordedBold_balanceBefore, 0)

    // await defaultPool.increaseBoldDebt(100, { from: mockTroveManagerAddress })
    const increaseBoldDebtData = th.getTransactionData('increaseBoldDebt(uint256)', ['0x64'])
    const tx = await mockTroveManager.forward(defaultPool.address, increaseBoldDebtData)
    assert.isTrue(tx.receipt.status)

    const recordedBold_balanceAfter = await defaultPool.getBoldDebt()
    assert.equal(recordedBold_balanceAfter, 100)
  })
  
  it('decreaseBold(): decreases the recorded BOLD balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await defaultPool.increaseBoldDebt(100, { from: mockTroveManagerAddress })
    const increaseBoldDebtData = th.getTransactionData('increaseBoldDebt(uint256)', ['0x64'])
    const tx1 = await mockTroveManager.forward(defaultPool.address, increaseBoldDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedBold_balanceBefore = await defaultPool.getBoldDebt()
    assert.equal(recordedBold_balanceBefore, 100)

    // await defaultPool.decreaseBoldDebt(100, { from: mockTroveManagerAddress })
    const decreaseBoldDebtData = th.getTransactionData('decreaseBoldDebt(uint256)', ['0x64'])
    const tx2 = await mockTroveManager.forward(defaultPool.address, decreaseBoldDebtData)
    assert.isTrue(tx2.receipt.status)

    const recordedBold_balanceAfter = await defaultPool.getBoldDebt()
    assert.equal(recordedBold_balanceAfter, 0)
  })

  // send raw ether
  it('sendETHToActivePool(): decreases the recorded ETH balance by the correct amount', async () => {
    // setup: give pool 2 ether
    const defaultPool_initialBalance = web3.utils.toBN(await WETH.balanceOf(defaultPool.address))
    assert.equal(defaultPool_initialBalance, 0)

    // start pool with 2 ether
    //await web3.eth.sendTransaction({ from: mockActivePool.address, to: defaultPool.address, value: dec(2, 'ether') })
    const eth_amount = dec(2, 'ether');
    await WETH.mint(mockActivePool.address, eth_amount);
    // approve
    const approveData = th.getTransactionData('approve(address,uint256)', [defaultPool.address, web3.utils.toHex(eth_amount)]);
    await mockActivePool.forward(WETH.address, approveData, { from: owner });
    // call receiveETH
    const receiveETHData = th.getTransactionData('receiveETH(uint256)', [web3.utils.toHex(eth_amount)]);
    const tx1 = await mockActivePool.forward(defaultPool.address, receiveETHData, { from: owner });
    assert.isTrue(tx1.receipt.status)

    const defaultPool_BalanceBeforeTx = web3.utils.toBN(await WETH.balanceOf(defaultPool.address))
    const activePool_Balance_BeforeTx = web3.utils.toBN(await WETH.balanceOf(mockActivePool.address))

    assert.equal(defaultPool_BalanceBeforeTx, dec(2, 'ether'))

    // send ether from pool to alice
    //await defaultPool.sendETHToActivePool(dec(1, 'ether'), { from: mockTroveManagerAddress })
    const sendETHData = th.getTransactionData('sendETHToActivePool(uint256)', [web3.utils.toHex(dec(1, 'ether'))])
    await mockActivePool.setPayable(true)
    const tx2 = await mockTroveManager.forward(defaultPool.address, sendETHData, { from: owner })
    assert.isTrue(tx2.receipt.status)

    const defaultPool_BalanceAfterTx = web3.utils.toBN(await WETH.balanceOf(defaultPool.address))
    const activePool_Balance_AfterTx = web3.utils.toBN(await WETH.balanceOf(mockActivePool.address))

    const activePool_BalanceChange = activePool_Balance_AfterTx.sub(activePool_Balance_BeforeTx)
    const defaultPool_BalanceChange = defaultPool_BalanceAfterTx.sub(defaultPool_BalanceBeforeTx)
    //assert.equal(activePool_BalanceChange, dec(1, 'ether'))
    //assert.equal(defaultPool_BalanceChange, _minus_1_Ether)
  })
})

contract('Reset chain state', async accounts => {})
