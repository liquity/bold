// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IERC20Metadata as IERC20} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IGovernance} from "V2-gov/src/interfaces/IGovernance.sol";
import {IUserProxyFactory} from "V2-gov/src/interfaces/IUserProxyFactory.sol";
import {CurveV2GaugeRewards} from "V2-gov/src/CurveV2GaugeRewards.sol";
import {ILeverageZapper} from "src/Zappers/Interfaces/ILeverageZapper.sol";
import {IZapper} from "src/Zappers/Interfaces/IZapper.sol";
import {Ownable} from "src/Dependencies/Ownable.sol";
import {IActivePool} from "src/Interfaces/IActivePool.sol";
import {IAddressesRegistry} from "src/Interfaces/IAddressesRegistry.sol";
import {IBoldToken} from "src/Interfaces/IBoldToken.sol";
import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import {ICollateralRegistry} from "src/Interfaces/ICollateralRegistry.sol";
import {IDefaultPool} from "src/Interfaces/IDefaultPool.sol";
import {IHintHelpers} from "src/Interfaces/IHintHelpers.sol";
import {ISortedTroves} from "src/Interfaces/ISortedTroves.sol";
import {ITroveManager} from "src/Interfaces/ITroveManager.sol";
import {ITroveNFT} from "src/Interfaces/ITroveNFT.sol";
import {IPriceFeed} from "src/Interfaces/IPriceFeed.sol";
import {IStabilityPool} from "src/Interfaces/IStabilityPool.sol";
import {IWETH} from "src/Interfaces/IWETH.sol";
import {ICurveStableSwapNG} from "./Interfaces/Curve/ICurveStableSwapNG.sol";
import {ILiquidityGaugeV6} from "./Interfaces/Curve/ILiquidityGaugeV6.sol";
import {ERC20Faucet} from "./TestContracts/ERC20Faucet.sol";

address constant ETH_WHALE = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Anvil account #1
address constant WETH_WHALE = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // Anvil account #2
address constant WSTETH_WHALE = 0xd85351181b3F264ee0FDFa94518464d7c3DefaDa;
address constant RETH_WHALE = 0xE76af4a9A3E71681F4C9BE600A0BA8D9d249175b;
address constant USDC_WHALE = 0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341;
address constant LQTY_WHALE = 0xA78f19D7f331247212C6d9C0F27D3d9464D3604D;

function coalesce(address a, address b) pure returns (address) {
    return a != address(0) ? a : b;
}

contract SideEffectFreeGetPriceHelper {
    function _revert(bytes memory revertData) internal pure {
        assembly {
            revert(add(32, revertData), mload(revertData))
        }
    }

    function throwPrice(IPriceFeed priceFeed) external {
        (uint256 price,) = priceFeed.fetchPrice();
        _revert(abi.encode(price));
    }
}

library SideEffectFreeGetPrice {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    // Random address
    address private constant helperDeployer = 0x9C82588e2B9229168aDbb55E730e0d20c0581a3B;

    // Deterministic address of first contract deployed by `helperDeployer`
    SideEffectFreeGetPriceHelper private constant helper =
        SideEffectFreeGetPriceHelper(0xc583097AE39B039fA74bB5bd6479469290B7cDe5);

    function deploy() internal {
        if (address(helper).code.length == 0) {
            vm.prank(helperDeployer);
            new SideEffectFreeGetPriceHelper();
        }
    }

    function getPrice(IPriceFeed priceFeed) internal returns (uint256) {
        deploy();

        try helper.throwPrice(priceFeed) {
            revert("SideEffectFreeGetPrice: throwPrice() should have reverted");
        } catch (bytes memory revertData) {
            return abi.decode(revertData, (uint256));
        }
    }
}

library StringEquality {
    function eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function notEq(string memory a, string memory b) internal pure returns (bool) {
        return !eq(a, b);
    }
}

contract E2ETest is Test {
    using SideEffectFreeGetPrice for IPriceFeed;
    using Strings for uint256;
    using stdJson for string;
    using StringEquality for string;

    struct BranchContracts {
        IERC20 collToken;
        IAddressesRegistry addressesRegistry;
        IPriceFeed priceFeed;
        ITroveNFT troveNFT;
        ITroveManager troveManager;
        IBorrowerOperations borrowerOperations;
        ISortedTroves sortedTroves;
        IActivePool activePool;
        IDefaultPool defaultPool;
        IStabilityPool stabilityPool;
        ILeverageZapper leverageZapper;
        IZapper zapper;
    }

    address WETH;
    address WSTETH;
    address RETH;
    address BOLD;
    address USDC;
    address LQTY;

    uint256 ETH_GAS_COMPENSATION;
    uint256 MIN_DEBT;
    uint256 EPOCH_DURATION;
    uint256 REGISTRATION_FEE;

    IWETH weth;
    IERC20 usdc;
    IERC20 lqty;

    mapping(address token => address) providerOf;

    ICollateralRegistry collateralRegistry;
    IBoldToken boldToken;
    IHintHelpers hintHelpers;
    IGovernance governance;
    ICurveStableSwapNG curveUsdcBold;
    ILiquidityGaugeV6 curveUsdcBoldGauge;
    CurveV2GaugeRewards curveUsdcBoldInitiative;
    BranchContracts[] branches;

    address[] ownables;

    address[] initiativesToReset;
    address[] initiatives;
    int256[] votes;
    int256[] vetos;

    function setUp() external {
        vm.skip(vm.envOr("FOUNDRY_PROFILE", string("")).notEq("e2e"));
        vm.createSelectFork(vm.envString("E2E_RPC_URL"));

        string memory json = vm.readFile("deployment-manifest.json");
        collateralRegistry = ICollateralRegistry(json.readAddress(".collateralRegistry"));
        boldToken = IBoldToken(BOLD = json.readAddress(".boldToken"));
        hintHelpers = IHintHelpers(json.readAddress(".hintHelpers"));
        governance = IGovernance(json.readAddress(".governance.governance"));
        curveUsdcBold = ICurveStableSwapNG(json.readAddress(".governance.curvePool"));
        curveUsdcBoldGauge = ILiquidityGaugeV6(json.readAddress(".governance.gauge"));
        curveUsdcBoldInitiative = CurveV2GaugeRewards(json.readAddress(".governance.curveV2GaugeRewardsInitiative"));

        vm.label(address(collateralRegistry), "CollateralRegistry");
        vm.label(address(hintHelpers), "HintHelpers");
        vm.label(address(governance), "Governance");
        vm.label(address(curveUsdcBold), "CurveStableSwapNG");
        vm.label(address(curveUsdcBoldGauge), "LiquidityGaugeV6");
        vm.label(address(curveUsdcBoldInitiative), "CurveV2GaugeRewards");

        ETH_GAS_COMPENSATION = json.readUint(".constants.ETH_GAS_COMPENSATION");
        MIN_DEBT = json.readUint(".constants.MIN_DEBT");
        EPOCH_DURATION = json.readUint(".governance.constants.EPOCH_DURATION");
        REGISTRATION_FEE = json.readUint(".governance.constants.REGISTRATION_FEE");
        LQTY = json.readAddress(".governance.LQTYToken");
        USDC = curveUsdcBold.coins(0) != BOLD ? curveUsdcBold.coins(0) : curveUsdcBold.coins(1);

        for (uint256 i = 0; i < collateralRegistry.totalCollaterals(); ++i) {
            string memory branch = string.concat(".branches[", i.toString(), "]");

            branches.push() = BranchContracts({
                collToken: IERC20(json.readAddress(string.concat(branch, ".collToken"))),
                addressesRegistry: IAddressesRegistry(json.readAddress(string.concat(branch, ".addressesRegistry"))),
                priceFeed: IPriceFeed(json.readAddress(string.concat(branch, ".priceFeed"))),
                troveNFT: ITroveNFT(json.readAddress(string.concat(branch, ".troveNFT"))),
                troveManager: ITroveManager(json.readAddress(string.concat(branch, ".troveManager"))),
                borrowerOperations: IBorrowerOperations(json.readAddress(string.concat(branch, ".borrowerOperations"))),
                sortedTroves: ISortedTroves(json.readAddress(string.concat(branch, ".sortedTroves"))),
                activePool: IActivePool(json.readAddress(string.concat(branch, ".activePool"))),
                defaultPool: IDefaultPool(json.readAddress(string.concat(branch, ".defaultPool"))),
                stabilityPool: IStabilityPool(json.readAddress(string.concat(branch, ".stabilityPool"))),
                leverageZapper: ILeverageZapper(json.readAddress(string.concat(branch, ".leverageZapper"))),
                zapper: IZapper(
                    coalesce(
                        json.readAddress(string.concat(branch, ".wethZapper")),
                        json.readAddress(string.concat(branch, ".gasCompZapper"))
                    )
                )
            });

            vm.label(address(branches[i].priceFeed), "PriceFeed");
            vm.label(address(branches[i].troveNFT), "TroveNFT");
            vm.label(address(branches[i].troveManager), "TroveManager");
            vm.label(address(branches[i].borrowerOperations), "BorrowerOperations");
            vm.label(address(branches[i].sortedTroves), "SortedTroves");
            vm.label(address(branches[i].activePool), "ActivePool");
            vm.label(address(branches[i].defaultPool), "DefaultPool");
            vm.label(address(branches[i].stabilityPool), "StabilityPool");
            vm.label(address(branches[i].leverageZapper), "LeverageZapper");
            vm.label(address(branches[i].zapper), "Zapper");

            string memory collSymbol = branches[i].collToken.symbol();
            if (collSymbol.eq("WETH")) {
                WETH = address(branches[i].collToken);
            } else if (collSymbol.eq("wstETH")) {
                WSTETH = address(branches[i].collToken);
            } else if (collSymbol.eq("rETH")) {
                RETH = address(branches[i].collToken);
            } else {
                revert(string.concat("Unexpected collateral ", collSymbol));
            }
        }

        vm.label(WETH, "WETH");
        vm.label(WSTETH, "wstETH");
        vm.label(RETH, "rETH");
        vm.label(BOLD, "BOLD");
        vm.label(USDC, "USDC");
        vm.label(LQTY, "LQTY");

        weth = IWETH(WETH);
        usdc = IERC20(USDC);
        lqty = IERC20(LQTY);

        vm.label(ETH_WHALE, "ETH_WHALE");
        vm.label(WETH_WHALE, "WETH_WHALE");
        vm.label(WSTETH_WHALE, "WSTETH_WHALE");
        vm.label(RETH_WHALE, "RETH_WHALE");
        vm.label(USDC_WHALE, "USDC_WHALE");
        vm.label(LQTY_WHALE, "LQTY_WHALE");

        providerOf[WETH] = WETH_WHALE;
        providerOf[WSTETH] = WSTETH_WHALE;
        providerOf[RETH] = RETH_WHALE;
        providerOf[USDC] = USDC_WHALE;
        providerOf[LQTY] = LQTY_WHALE;

        vm.prank(WETH_WHALE);
        weth.deposit{value: WETH_WHALE.balance}();

        // Testnet
        if (block.chainid != 1) {
            address[4] memory coins = [WSTETH, RETH, USDC, LQTY];

            for (uint256 i = 0; i < coins.length; ++i) {
                ERC20Faucet faucet = ERC20Faucet(coins[i]);
                vm.prank(faucet.owner());
                faucet.mint(providerOf[coins[i]], 1e6 ether);
            }
        }
    }

    function deal(address to, uint256 give) internal virtual override {
        if (to.balance < give) {
            vm.prank(ETH_WHALE);
            payable(to).transfer(give - to.balance);
        } else {
            vm.prank(to);
            payable(ETH_WHALE).transfer(to.balance - give);
        }
    }

    function deal(address token, address to, uint256 give) internal virtual override {
        uint256 balance = IERC20(token).balanceOf(to);
        address provider = providerOf[token];

        assertNotEq(provider, address(0), string.concat("No provider for ", IERC20(token).symbol()));

        if (balance < give) {
            vm.prank(provider);
            IERC20(token).transfer(to, give - balance);
        } else {
            vm.prank(to);
            IERC20(token).transfer(provider, balance - give);
        }
    }

    function deal(address token, address to, uint256 give, bool) internal virtual override {
        deal(token, to, give);
    }

    function _openTrove(uint256 i, address owner, uint256 ownerIndex, uint256 boldAmount) internal returns (uint256) {
        IZapper.OpenTroveParams memory p;
        p.owner = owner;
        p.ownerIndex = ownerIndex;
        p.boldAmount = boldAmount;
        p.collAmount = boldAmount * 2 ether / branches[i].priceFeed.getPrice();
        p.annualInterestRate = 0.05 ether;
        p.maxUpfrontFee = hintHelpers.predictOpenTroveUpfrontFee(i, boldAmount, p.annualInterestRate);

        (uint256 collTokenAmount, uint256 value) = branches[i].collToken == weth
            ? (0, p.collAmount + ETH_GAS_COMPENSATION)
            : (p.collAmount, ETH_GAS_COMPENSATION);

        deal(owner, value);
        deal(address(branches[i].collToken), owner, collTokenAmount);

        vm.startPrank(owner);
        branches[i].collToken.approve(address(branches[i].zapper), collTokenAmount);
        branches[i].zapper.openTroveWithRawETH{value: value}(p);
        vm.stopPrank();

        return boldAmount;
    }

    function _troveId(address owner, uint256 ownerIndex) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(owner, ownerIndex)));
    }

    function _closeTroveFromCollateral(uint256 i, address owner, uint256 ownerIndex) internal returns (uint256) {
        uint256 troveId = _troveId(owner, ownerIndex);
        uint256 debt = branches[i].troveManager.getLatestTroveData(troveId).entireDebt;
        IZapper zapper = IZapper(branches[i].borrowerOperations.addManagerOf(troveId));

        vm.startPrank(owner);
        zapper.closeTroveFromCollateral({
            _troveId: troveId,
            _flashLoanAmount: debt * 1.01 ether / branches[i].priceFeed.getPrice()
        });
        vm.stopPrank();

        return debt;
    }

    function _openLeveragedTrove(uint256 i, address owner, uint256 ownerIndex, uint256 boldAmount)
        internal
        returns (uint256)
    {
        uint256 price = branches[i].priceFeed.getPrice();

        ILeverageZapper.OpenLeveragedTroveParams memory p;
        p.owner = owner;
        p.ownerIndex = ownerIndex;
        p.boldAmount = boldAmount;
        p.collAmount = boldAmount * 0.5 ether / price;
        p.flashLoanAmount = boldAmount * 0.99 ether / price;
        p.annualInterestRate = 0.1 ether;
        p.maxUpfrontFee = hintHelpers.predictOpenTroveUpfrontFee(i, boldAmount, p.annualInterestRate);

        (uint256 collTokenAmount, uint256 value) = branches[i].collToken == weth
            ? (0, p.collAmount + ETH_GAS_COMPENSATION)
            : (p.collAmount, ETH_GAS_COMPENSATION);

        deal(owner, value);
        deal(address(branches[i].collToken), owner, collTokenAmount);

        vm.startPrank(owner);
        branches[i].collToken.approve(address(branches[i].leverageZapper), collTokenAmount);
        branches[i].leverageZapper.openLeveragedTroveWithRawETH{value: value}(p);
        vm.stopPrank();

        return boldAmount;
    }

    function _leverUpTrove(uint256 i, address owner, uint256 ownerIndex, uint256 boldAmount)
        internal
        returns (uint256)
    {
        uint256 troveId = _troveId(owner, ownerIndex);

        ILeverageZapper.LeverUpTroveParams memory p = ILeverageZapper.LeverUpTroveParams({
            troveId: troveId,
            boldAmount: boldAmount,
            flashLoanAmount: boldAmount * 0.99 ether / branches[i].priceFeed.getPrice(),
            maxUpfrontFee: hintHelpers.predictAdjustTroveUpfrontFee(i, troveId, boldAmount)
        });

        vm.prank(owner);
        branches[i].leverageZapper.leverUpTrove(p);

        return boldAmount;
    }

    function _leverDownTrove(uint256 i, address owner, uint256 ownerIndex, uint256 boldAmount)
        internal
        returns (uint256)
    {
        uint256 troveId = _troveId(owner, ownerIndex);
        uint256 debtBefore = branches[i].troveManager.getLatestTroveData(troveId).entireDebt;

        ILeverageZapper.LeverDownTroveParams memory p = ILeverageZapper.LeverDownTroveParams({
            troveId: troveId,
            minBoldAmount: boldAmount,
            flashLoanAmount: boldAmount * 1.01 ether / branches[i].priceFeed.getPrice()
        });

        vm.prank(owner);
        branches[i].leverageZapper.leverDownTrove(p);

        return debtBefore - branches[i].troveManager.getLatestTroveData(troveId).entireDebt;
    }

    function _addCurveLiquidity(
        address liquidityProvider,
        ICurveStableSwapNG pool,
        uint256 coin0Amount,
        address coin0,
        uint256 coin1Amount,
        address coin1
    ) internal {
        uint256[] memory amounts = new uint256[](2);
        (amounts[0], amounts[1]) =
            curveUsdcBold.coins(0) == coin0 ? (coin0Amount, coin1Amount) : (coin1Amount, coin0Amount);

        deal(coin0, liquidityProvider, coin0Amount);
        deal(coin1, liquidityProvider, coin1Amount);

        vm.startPrank(liquidityProvider);
        IERC20(coin0).approve(address(pool), coin0Amount);
        IERC20(coin1).approve(address(pool), coin1Amount);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();
    }

    function _depositIntoCurveGauge(address liquidityProvider, ILiquidityGaugeV6 gauge, uint256 amount) internal {
        vm.startPrank(liquidityProvider);
        gauge.lp_token().approve(address(gauge), amount);
        gauge.deposit(amount);
        vm.stopPrank();
    }

    function _claimRewardsFromCurveGauge(address liquidityProvider, ILiquidityGaugeV6 gauge) internal {
        vm.prank(liquidityProvider);
        gauge.claim_rewards();
    }

    function _provideToSP(uint256 i, address depositor, uint256 boldAmount) internal {
        deal(BOLD, depositor, boldAmount);
        vm.prank(depositor);
        branches[i].stabilityPool.provideToSP(boldAmount, false);
    }

    function _claimFromSP(uint256 i, address depositor) internal {
        vm.prank(depositor);
        branches[i].stabilityPool.withdrawFromSP(0, true);
    }

    function _depositLQTY(address voter, uint256 amount) internal {
        deal(LQTY, voter, amount);

        vm.startPrank(voter);
        lqty.approve(IUserProxyFactory(address(governance)).deriveUserProxyAddress(voter), amount);
        governance.depositLQTY(amount);
        vm.stopPrank();
    }

    function _allocateLQTY_begin(address voter) internal {
        vm.startPrank(voter);
    }

    function _allocateLQTY_reset(address initiative) internal {
        initiativesToReset.push(initiative);
    }

    function _allocateLQTY_vote(address initiative, int256 lqtyAmount) internal {
        initiatives.push(initiative);
        votes.push(lqtyAmount);
        vetos.push();
    }

    function _allocateLQTY_veto(address initiative, int256 lqtyAmount) internal {
        initiatives.push(initiative);
        votes.push();
        vetos.push(lqtyAmount);
    }

    function _allocateLQTY_end() internal {
        governance.allocateLQTY(initiativesToReset, initiatives, votes, vetos);

        delete initiativesToReset;
        delete initiatives;
        delete votes;
        delete vetos;

        vm.stopPrank();
    }

    function test_OwnershipRenounced() external {
        ownables.push(address(boldToken));

        for (uint256 i = 0; i < branches.length; ++i) {
            ownables.push(address(branches[i].addressesRegistry));
            if (block.chainid == 1) ownables.push(address(branches[i].priceFeed));
        }

        for (uint256 i = 0; i < ownables.length; ++i) {
            assertEq(
                Ownable(ownables[i]).owner(),
                address(0),
                string.concat("Ownership of ", vm.getLabel(ownables[i]), " should have been renounced")
            );
        }
    }

    function test_Initially_NewInitiativeCannotBeRegistered() external {
        vm.skip(governance.epoch() != 2);

        address registrant = makeAddr("registrant");
        address newInitiative = makeAddr("newInitiative");

        _openTrove(0, registrant, 0, Math.max(REGISTRATION_FEE, MIN_DEBT));

        vm.startPrank(registrant);
        {
            boldToken.approve(address(governance), REGISTRATION_FEE);
            vm.expectRevert("Governance: registration-not-yet-enabled");
            governance.registerInitiative(newInitiative);
        }
        vm.stopPrank();
    }

    function test_AfterOneEpoch_NewInitiativeCanBeRegistered() external {
        vm.skip(governance.epoch() != 2);

        address registrant = makeAddr("registrant");
        address newInitiative = makeAddr("newInitiative");

        _openTrove(0, registrant, 0, Math.max(REGISTRATION_FEE, MIN_DEBT));

        skip(EPOCH_DURATION);

        vm.startPrank(registrant);
        {
            boldToken.approve(address(governance), REGISTRATION_FEE);
            governance.registerInitiative(newInitiative);
        }
        vm.stopPrank();
    }

    function test_E2E() external {
        // Test assumes that all Stability Pools are empty in the beginning
        for (uint256 i = 0; i < branches.length; ++i) {
            vm.skip(branches[i].stabilityPool.getTotalBoldDeposits() != 0);
        }

        uint256 repaid;
        uint256 borrowed = boldToken.totalSupply() - boldToken.balanceOf(address(governance));

        for (uint256 i = 0; i < branches.length; ++i) {
            borrowed -= boldToken.balanceOf(address(branches[i].stabilityPool));
        }

        if (block.chainid == 1) {
            assertEqDecimal(borrowed, 0, 18, "Mainnet deployment script should not have borrowed anything");
            assertNotEq(address(curveUsdcBoldGauge), address(0), "Mainnet should have USDC-BOLD gauge");
            assertNotEq(address(curveUsdcBoldInitiative), address(0), "Mainnet should have USDC-BOLD initiative");
        }

        address borrower = providerOf[BOLD] = makeAddr("borrower");

        for (uint256 j = 0; j < 5; ++j) {
            for (uint256 i = 0; i < branches.length; ++i) {
                skip(5 minutes);
                borrowed += _openTrove(i, borrower, j, 10_000 ether);
            }
        }

        address liquidityProvider = makeAddr("liquidityProvider");
        {
            skip(5 minutes);

            uint256 boldAmount = boldToken.balanceOf(borrower) * 4 / 5;
            uint256 usdcAmount = boldAmount * 10 ** usdc.decimals() / 10 ** boldToken.decimals();
            _addCurveLiquidity(liquidityProvider, curveUsdcBold, boldAmount, BOLD, usdcAmount, USDC);

            if (address(curveUsdcBoldGauge) != address(0)) {
                _depositIntoCurveGauge(
                    liquidityProvider, curveUsdcBoldGauge, curveUsdcBold.balanceOf(liquidityProvider)
                );
            }
        }

        address stabilityDepositor = makeAddr("stabilityDepositor");

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            _provideToSP(i, stabilityDepositor, boldToken.balanceOf(borrower) / (branches.length - i));
        }

        address leverageSeeker = makeAddr("leverageSeeker");

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            borrowed += _openLeveragedTrove(i, leverageSeeker, 0, 10_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            borrowed += _leverUpTrove(i, leverageSeeker, 0, 1_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            repaid += _leverDownTrove(i, leverageSeeker, 0, 1_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            repaid += _closeTroveFromCollateral(i, leverageSeeker, 0);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            repaid += _closeTroveFromCollateral(i, borrower, 0);
        }

        if (address(curveUsdcBoldInitiative) != address(0)) {
            address voter = makeAddr("voter");
            skip(5 minutes);

            _depositLQTY(voter, 10_000 ether);
            _allocateLQTY_begin(voter);
            _allocateLQTY_vote(address(curveUsdcBoldInitiative), 10_000 ether);
            _allocateLQTY_end();
        }

        skip(EPOCH_DURATION);

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            _claimFromSP(i, stabilityDepositor);
        }

        uint256 interest = boldToken.totalSupply() + repaid - borrowed;
        uint256 spReward = boldToken.balanceOf(stabilityDepositor);
        uint256 governanceReward = boldToken.balanceOf(address(governance));

        assertApproxEqRelDecimal(
            interest,
            spReward + governanceReward,
            1e-16 ether,
            18,
            "Stability depositor and Governance should have received the interest"
        );

        if (address(curveUsdcBoldGauge) != address(0)) {
            governance.claimForInitiative(address(curveUsdcBoldInitiative));
            uint256 gaugeReward = boldToken.balanceOf(address(curveUsdcBoldGauge));

            assertApproxEqRelDecimal(
                boldToken.totalSupply() + repaid - borrowed,
                spReward + gaugeReward,
                1e-16 ether,
                18,
                "Stability depositor and Curve gauge should have earned the interest"
            );

            skip(curveUsdcBoldInitiative.duration());
            _claimRewardsFromCurveGauge(liquidityProvider, curveUsdcBoldGauge);

            assertApproxEqRelDecimal(
                boldToken.balanceOf(liquidityProvider),
                gaugeReward,
                1e-14 ether,
                18,
                "Liquidity provider should have earned the reward from Curve gauge"
            );
        }
    }

    // This can be used to check that everything's still working as expected in a live testnet deployment
    function test_Borrowing_InExistingDeployment() external {
        for (uint256 i = 0; i < branches.length; ++i) {
            vm.skip(branches[i].troveManager.getTroveIdsCount() == 0);
        }

        address borrower = makeAddr("borrower");

        for (uint256 i = 0; i < branches.length; ++i) {
            _openTrove(i, borrower, 0, 10_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            _closeTroveFromCollateral(i, borrower, 0);
        }

        address leverageSeeker = makeAddr("leverageSeeker");

        for (uint256 i = 0; i < branches.length; ++i) {
            _openLeveragedTrove(i, leverageSeeker, 0, 10_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            _leverUpTrove(i, leverageSeeker, 0, 1_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            _leverDownTrove(i, leverageSeeker, 0, 1_000 ether);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            _closeTroveFromCollateral(i, leverageSeeker, 0);
        }
    }
}
