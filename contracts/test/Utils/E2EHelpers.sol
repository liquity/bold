// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Vm} from "forge-std/Vm.sol";
import {Test} from "forge-std/Test.sol";
import {IERC20Metadata as IERC20} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {Governance} from "V2-gov/src/Governance.sol";
import {ILeverageZapper} from "src/Zappers/Interfaces/ILeverageZapper.sol";
import {IZapper} from "src/Zappers/Interfaces/IZapper.sol";
import {IPriceFeed} from "src/Interfaces/IPriceFeed.sol";
import {IBorrowerOperationsV1} from "../Interfaces/LiquityV1/IBorrowerOperationsV1.sol";
import {IPriceFeedV1} from "../Interfaces/LiquityV1/IPriceFeedV1.sol";
import {ISortedTrovesV1} from "../Interfaces/LiquityV1/ISortedTrovesV1.sol";
import {ITroveManagerV1} from "../Interfaces/LiquityV1/ITroveManagerV1.sol";
import {ERC20Faucet} from "../TestContracts/ERC20Faucet.sol";

import {StringEquality} from "./StringEquality.sol";
import {UseDeployment} from "./UseDeployment.sol";
import {TroveId} from "./TroveId.sol";

uint256 constant PRICE_TOLERANCE = 0.05 ether;

address constant ETH_WHALE = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Anvil account #1
address constant WETH_WHALE = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // Anvil account #2
address constant WSTETH_WHALE = 0xd85351181b3F264ee0FDFa94518464d7c3DefaDa;
address constant RETH_WHALE = 0xE76af4a9A3E71681F4C9BE600A0BA8D9d249175b;
address constant USDC_WHALE = 0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341;
address constant LQTY_WHALE = 0xA78f19D7f331247212C6d9C0F27D3d9464D3604D;
address constant LUSD_WHALE = 0xcd6Eb888e76450eF584E8B51bB73c76ffBa21FF2;

IBorrowerOperationsV1 constant mainnet_V1_borrowerOperations =
    IBorrowerOperationsV1(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
IPriceFeedV1 constant mainnet_V1_priceFeed = IPriceFeedV1(0x4c517D4e2C851CA76d7eC94B805269Df0f2201De);
ISortedTrovesV1 constant mainnet_V1_sortedTroves = ISortedTrovesV1(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6);
ITroveManagerV1 constant mainnet_V1_troveManager = ITroveManagerV1(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);

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

    function throwPriceV1(IPriceFeedV1 priceFeed) external {
        _revert(abi.encode(priceFeed.fetchPrice()));
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

    function getPrice(IPriceFeedV1 priceFeed) internal returns (uint256) {
        deploy();

        try helper.throwPriceV1(priceFeed) {
            revert("SideEffectFreeGetPrice: throwPriceV1() should have reverted");
        } catch (bytes memory revertData) {
            return abi.decode(revertData, (uint256));
        }
    }
}

contract E2EHelpers is Test, UseDeployment, TroveId {
    using SideEffectFreeGetPrice for IPriceFeed;
    using StringEquality for string;

    mapping(address token => address) providerOf;

    address[] _allocateLQTY_initiativesToReset;
    address[] _allocateLQTY_initiatives;
    int256[] _allocateLQTY_votes;
    int256[] _allocateLQTY_vetos;

    function setUp() public virtual {
        vm.skip(vm.envOr("FOUNDRY_PROFILE", string("")).notEq("e2e"));
        vm.createSelectFork(vm.envString("E2E_RPC_URL"));
        _loadDeploymentFromManifest("deployment-manifest.json");

        vm.label(ETH_WHALE, "ETH_WHALE");
        vm.label(WETH_WHALE, "WETH_WHALE");
        vm.label(WSTETH_WHALE, "WSTETH_WHALE");
        vm.label(RETH_WHALE, "RETH_WHALE");
        vm.label(USDC_WHALE, "USDC_WHALE");
        vm.label(LQTY_WHALE, "LQTY_WHALE");
        vm.label(LUSD_WHALE, "LUSD_WHALE");

        providerOf[WETH] = WETH_WHALE;
        providerOf[WSTETH] = WSTETH_WHALE;
        providerOf[RETH] = RETH_WHALE;
        providerOf[USDC] = USDC_WHALE;
        providerOf[LQTY] = LQTY_WHALE;
        providerOf[LUSD] = LUSD_WHALE;

        vm.prank(WETH_WHALE);
        weth.deposit{value: WETH_WHALE.balance}();

        // Testnet
        if (block.chainid != 1) {
            address[5] memory coins = [WSTETH, RETH, USDC, LQTY, LUSD];

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

    function _closeTroveFromCollateral(uint256 i, address owner, uint256 ownerIndex, bool _leveraged)
        internal
        returns (uint256)
    {
        IZapper zapper;
        if (_leveraged) {
            zapper = branches[i].leverageZapper;
        } else {
            zapper = branches[i].zapper;
        }
        uint256 troveId = addressToTroveIdThroughZapper(address(zapper), owner, ownerIndex);
        uint256 debt = branches[i].troveManager.getLatestTroveData(troveId).entireDebt;
        uint256 coll = branches[i].troveManager.getLatestTroveData(troveId).entireColl;
        uint256 flashLoanAmount = debt * (1 ether + PRICE_TOLERANCE) / branches[i].priceFeed.getPrice();

        vm.startPrank(owner);
        zapper.closeTroveFromCollateral({
            _troveId: troveId,
            _flashLoanAmount: flashLoanAmount,
            _minExpectedCollateral: coll - flashLoanAmount
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
        p.flashLoanAmount = boldAmount * (1 ether - PRICE_TOLERANCE) / price;
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
        uint256 troveId = addressToTroveIdThroughZapper(address(branches[i].leverageZapper), owner, ownerIndex);

        ILeverageZapper.LeverUpTroveParams memory p = ILeverageZapper.LeverUpTroveParams({
            troveId: troveId,
            boldAmount: boldAmount,
            flashLoanAmount: boldAmount * (1 ether - PRICE_TOLERANCE) / branches[i].priceFeed.getPrice(),
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
        uint256 troveId = addressToTroveIdThroughZapper(address(branches[i].leverageZapper), owner, ownerIndex);
        uint256 debtBefore = branches[i].troveManager.getLatestTroveData(troveId).entireDebt;

        ILeverageZapper.LeverDownTroveParams memory p = ILeverageZapper.LeverDownTroveParams({
            troveId: troveId,
            minBoldAmount: boldAmount,
            flashLoanAmount: boldAmount * (1 ether + PRICE_TOLERANCE) / branches[i].priceFeed.getPrice()
        });

        vm.prank(owner);
        branches[i].leverageZapper.leverDownTrove(p);

        return debtBefore - branches[i].troveManager.getLatestTroveData(troveId).entireDebt;
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
        lqty.approve(governance.deriveUserProxyAddress(voter), amount);
        governance.depositLQTY(amount);
        vm.stopPrank();
    }

    function _allocateLQTY_begin(address voter) internal {
        vm.startPrank(voter);
    }

    function _allocateLQTY_reset(address initiative) internal {
        _allocateLQTY_initiativesToReset.push(initiative);
    }

    function _allocateLQTY_vote(address initiative, int256 lqtyAmount) internal {
        _allocateLQTY_initiatives.push(initiative);
        _allocateLQTY_votes.push(lqtyAmount);
        _allocateLQTY_vetos.push();
    }

    function _allocateLQTY_veto(address initiative, int256 lqtyAmount) internal {
        _allocateLQTY_initiatives.push(initiative);
        _allocateLQTY_votes.push();
        _allocateLQTY_vetos.push(lqtyAmount);
    }

    function _allocateLQTY_end() internal {
        governance.allocateLQTY(
            _allocateLQTY_initiativesToReset, _allocateLQTY_initiatives, _allocateLQTY_votes, _allocateLQTY_vetos
        );

        delete _allocateLQTY_initiativesToReset;
        delete _allocateLQTY_initiatives;
        delete _allocateLQTY_votes;
        delete _allocateLQTY_vetos;

        vm.stopPrank();
    }
}
