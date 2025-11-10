// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {MockStakingV1} from "V2-gov/test/mocks/MockStakingV1.sol";
import {CurveV2GaugeRewards} from "V2-gov/src/CurveV2GaugeRewards.sol";
import {Ownable} from "src/Dependencies/Ownable.sol";
import {ICurveStableSwapNG} from "./Interfaces/Curve/ICurveStableSwapNG.sol";
import {ILiquidityGaugeV6} from "./Interfaces/Curve/ILiquidityGaugeV6.sol";
import "./Utils/E2EHelpers.sol";

function coalesce(address a, address b) pure returns (address) {
    return a != address(0) ? a : b;
}

contract E2ETest is E2EHelpers {
    using SideEffectFreeGetPrice for IPriceFeedV1;

    struct Initiative {
        address addr;
        ILiquidityGaugeV6 gauge; // optional
    }

    address[] ownables;

    function _addCurveLiquidity(
        address liquidityProvider,
        ICurveStableSwapNG pool,
        uint256 coin0Amount,
        address coin0,
        uint256 coin1Amount,
        address coin1
    ) internal {
        uint256[] memory amounts = new uint256[](2);
        (amounts[0], amounts[1]) = pool.coins(0) == coin0 ? (coin0Amount, coin1Amount) : (coin1Amount, coin0Amount);

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

    function _mainnet_V1_openTroveAtTail(address owner, uint256 lusdAmount) internal returns (uint256 borrowingFee) {
        uint256 price = mainnet_V1_priceFeed.getPrice();
        address lastTrove = mainnet_V1_sortedTroves.getLast();
        assertGeDecimal(mainnet_V1_troveManager.getCurrentICR(lastTrove, price), 1.1 ether, 18, "last ICR < MCR");

        uint256 borrowingRate = mainnet_V1_troveManager.getBorrowingRateWithDecay();
        borrowingFee = lusdAmount * borrowingRate / 1 ether;
        uint256 debt = lusdAmount + borrowingFee + 200 ether;
        uint256 collAmount = Math.ceilDiv(debt * 1.1 ether, price);
        deal(owner, collAmount);

        vm.startPrank(owner);
        mainnet_V1_borrowerOperations.openTrove{value: collAmount}({
            _LUSDAmount: lusdAmount,
            _maxFeePercentage: borrowingRate,
            _upperHint: lastTrove,
            _lowerHint: address(0)
        });
        vm.stopPrank();

        assertEq(mainnet_V1_sortedTroves.getLast(), owner, "last Trove != new Trove");
    }

    function _mainnet_V1_redeemCollateralFromTroveAtTail(address redeemer, uint256 lusdAmount)
        internal
        returns (uint256 redemptionFee)
    {
        address lastTrove = mainnet_V1_sortedTroves.getLast();
        address prevTrove = mainnet_V1_sortedTroves.getPrev(lastTrove);
        (uint256 lastTroveDebt, uint256 lastTroveColl,,) = mainnet_V1_troveManager.getEntireDebtAndColl(lastTrove);
        assertLeDecimal(lusdAmount, lastTroveDebt - 2_000 ether, 18, "lusdAmount > redeemable from last Trove");

        uint256 price = mainnet_V1_priceFeed.getPrice();
        uint256 collAmount = lusdAmount * 1 ether / price;
        uint256 balanceBefore = redeemer.balance;

        vm.startPrank(redeemer);
        mainnet_V1_troveManager.redeemCollateral({
            _LUSDamount: lusdAmount,
            _maxFeePercentage: 1 ether,
            _maxIterations: 1,
            _firstRedemptionHint: lastTrove,
            _upperPartialRedemptionHint: prevTrove,
            _lowerPartialRedemptionHint: prevTrove,
            _partialRedemptionHintNICR: (lastTroveColl - collAmount) * 100 ether / (lastTroveDebt - lusdAmount)
        });
        vm.stopPrank();

        redemptionFee = collAmount * mainnet_V1_troveManager.getBorrowingRateWithDecay() / 1 ether;
        assertEqDecimal(redeemer.balance - balanceBefore, collAmount - redemptionFee, 18, "coll received != expected");
    }

    function _generateStakingRewards() internal returns (uint256 lusdAmount, uint256 ethAmount) {
        if (block.chainid == 1) {
            address stakingRewardGenerator = makeAddr("stakingRewardGenerator");
            lusdAmount = _mainnet_V1_openTroveAtTail(stakingRewardGenerator, 1e6 ether);
            ethAmount = _mainnet_V1_redeemCollateralFromTroveAtTail(stakingRewardGenerator, 1_000 ether);
        } else {
            // Testnet
            lusdAmount = 10_000 ether;
            ethAmount = 1 ether;

            MockStakingV1 stakingV1 = MockStakingV1(address(governance.stakingV1()));
            address owner = stakingV1.owner();

            deal(LUSD, owner, lusdAmount);
            deal(owner, ethAmount);

            vm.startPrank(owner);
            lusd.approve(address(stakingV1), lusdAmount);
            stakingV1.mock_addLUSDGain(lusdAmount);
            stakingV1.mock_addETHGain{value: ethAmount}();
            vm.stopPrank();
        }
    }

    function test_OwnershipRenounced() external {
        ownables.push(address(boldToken));

        for (uint256 i = 0; i < branches.length; ++i) {
            ownables.push(address(branches[i].addressesRegistry));
        }

        for (uint256 i = 0; i < ownables.length; ++i) {
            assertEq(
                Ownable(ownables[i]).owner(),
                address(0),
                string.concat("Ownership of ", vm.getLabel(ownables[i]), " should have been renounced")
            );
        }

        ILiquidityGaugeV6[2] memory gauges = [curveUsdcBoldGauge, curveLusdBoldGauge];

        for (uint256 i = 0; i < gauges.length; ++i) {
            if (address(gauges[i]) == address(0)) continue;
            address gaugeManager = gauges[i].manager();
            assertEq(gaugeManager, address(0), "Gauge manager role should have been renounced");
        }
    }

    function _epoch(uint256 n) internal view returns (uint256) {
        return EPOCH_START + (n - 1) * EPOCH_DURATION;
    }

    function test_Initially_NewInitiativeCannotBeRegistered() external {
        vm.skip(governance.epoch() > 2);

        address registrant = makeAddr("registrant");
        address newInitiative = makeAddr("newInitiative");

        _openTrove(0, registrant, 0, Math.max(REGISTRATION_FEE, MIN_DEBT));

        uint256 epoch2 = _epoch(2);
        if (block.timestamp < epoch2) vm.warp(epoch2);

        vm.startPrank(registrant);
        {
            boldToken.approve(address(governance), REGISTRATION_FEE);
            vm.expectRevert("Governance: registration-not-yet-enabled");
            governance.registerInitiative(newInitiative);
        }
        vm.stopPrank();
    }

    function test_AfterOneEpoch_NewInitiativeCanBeRegistered() external {
        vm.skip(governance.epoch() > 2);

        address registrant = makeAddr("registrant");
        address newInitiative = makeAddr("newInitiative");

        _openTrove(0, registrant, 0, Math.max(REGISTRATION_FEE, MIN_DEBT));

        uint256 epoch3 = _epoch(3);
        if (block.timestamp < epoch3) vm.warp(epoch3);

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
            assertNotEq(address(curveLusdBold), address(0), "Mainnet should have LUSD-BOLD pool");
            assertNotEq(address(curveLusdBoldGauge), address(0), "Mainnet should have LUSD-BOLD gauge");
            assertNotEq(address(curveLusdBoldInitiative), address(0), "Mainnet should have LUSD-BOLD initiative");
            assertNotEq(address(defiCollectiveInitiative), address(0), "Mainnet should have DeFi Collective initiative");
        }

        address borrower = providerOf[BOLD] = makeAddr("borrower");

        for (uint256 j = 0; j < 5; ++j) {
            for (uint256 i = 0; i < branches.length; ++i) {
                skip(5 minutes);
                borrowed += _openTrove(i, borrower, j, 20_000 ether);
            }
        }

        address liquidityProvider = makeAddr("liquidityProvider");
        {
            skip(5 minutes);

            uint256 boldAmount = boldToken.balanceOf(borrower) * 2 / 5;
            uint256 usdcAmount = boldAmount * 10 ** usdc.decimals() / 10 ** boldToken.decimals();
            uint256 lusdAmount = boldAmount;

            _addCurveLiquidity(liquidityProvider, curveUsdcBold, boldAmount, BOLD, usdcAmount, USDC);

            if (address(curveLusdBold) != address(0)) {
                _addCurveLiquidity(liquidityProvider, curveLusdBold, boldAmount, BOLD, lusdAmount, LUSD);
            }

            if (address(curveUsdcBoldGauge) != address(0)) {
                _depositIntoCurveGauge(
                    liquidityProvider, curveUsdcBoldGauge, curveUsdcBold.balanceOf(liquidityProvider)
                );
            }

            if (address(curveLusdBoldGauge) != address(0)) {
                _depositIntoCurveGauge(
                    liquidityProvider, curveLusdBoldGauge, curveLusdBold.balanceOf(liquidityProvider)
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
            repaid += _closeTroveFromCollateral(i, leverageSeeker, 0, true);
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            repaid += _closeTroveFromCollateral(i, borrower, 0, false);
        }

        skip(5 minutes);

        Initiative[] memory initiatives = new Initiative[](initialInitiatives.length);
        for (uint256 i = 0; i < initiatives.length; ++i) {
            initiatives[i].addr = initialInitiatives[i];
            if (initialInitiatives[i] == address(curveUsdcBoldInitiative)) initiatives[i].gauge = curveUsdcBoldGauge;
            if (initialInitiatives[i] == address(curveLusdBoldInitiative)) initiatives[i].gauge = curveLusdBoldGauge;
        }

        address staker = makeAddr("staker");
        {
            uint256 lqtyStake = 30_000 ether;
            _depositLQTY(staker, lqtyStake);

            skip(5 minutes);

            (uint256 lusdAmount, uint256 ethAmount) = _generateStakingRewards();
            uint256 totalLQTYStaked = governance.stakingV1().totalLQTYStaked();

            skip(5 minutes);

            vm.prank(staker);
            governance.claimFromStakingV1(staker);

            assertApproxEqAbsDecimal(
                lusd.balanceOf(staker), lusdAmount * lqtyStake / totalLQTYStaked, 1e5, 18, "LUSD reward"
            );
            assertApproxEqAbsDecimal(staker.balance, ethAmount * lqtyStake / totalLQTYStaked, 1e5, 18, "ETH reward");

            skip(5 minutes);

            if (initiatives.length > 0) {
                // Voting on initial initiatives opens in epoch #2
                uint256 votingStart = _epoch(2);
                if (block.timestamp < votingStart) vm.warp(votingStart);

                _allocateLQTY_begin(staker);

                for (uint256 i = 0; i < initiatives.length; ++i) {
                    _allocateLQTY_vote(initiatives[i].addr, int256(lqtyStake / initiatives.length));
                }

                _allocateLQTY_end();
            }
        }

        skip(EPOCH_DURATION);

        for (uint256 i = 0; i < branches.length; ++i) {
            skip(5 minutes);
            _claimFromSP(i, stabilityDepositor);
        }

        uint256 interest = boldToken.totalSupply() + repaid - borrowed;
        uint256 spShareOfInterest = boldToken.balanceOf(stabilityDepositor);
        uint256 governanceShareOfInterest = boldToken.balanceOf(address(governance));

        assertApproxEqRelDecimal(
            interest,
            spShareOfInterest + governanceShareOfInterest,
            1e-16 ether,
            18,
            "Stability depositor and Governance should have received the interest"
        );

        if (initiatives.length > 0) {
            uint256 initiativeShareOfInterest;

            for (uint256 i = 0; i < initiatives.length; ++i) {
                governance.claimForInitiative(initiatives[i].addr);
                initiativeShareOfInterest +=
                    boldToken.balanceOf(coalesce(address(initiatives[i].gauge), initiatives[i].addr));
            }

            assertApproxEqRelDecimal(
                governanceShareOfInterest,
                initiativeShareOfInterest,
                1e-15 ether,
                18,
                "Initiatives should have received the interest from Governance"
            );

            uint256 numGauges;
            uint256 maxGaugeDuration;

            for (uint256 i = 0; i < initiatives.length; ++i) {
                if (address(initiatives[i].gauge) != address(0)) {
                    maxGaugeDuration = Math.max(maxGaugeDuration, CurveV2GaugeRewards(initiatives[i].addr).duration());
                    ++numGauges;
                }
            }

            skip(maxGaugeDuration);

            if (numGauges > 0) {
                uint256 gaugeShareOfInterest;

                for (uint256 i = 0; i < initiatives.length; ++i) {
                    if (address(initiatives[i].gauge) != address(0)) {
                        gaugeShareOfInterest += boldToken.balanceOf(address(initiatives[i].gauge));
                        _claimRewardsFromCurveGauge(liquidityProvider, initiatives[i].gauge);
                    }
                }

                assertApproxEqRelDecimal(
                    boldToken.balanceOf(liquidityProvider),
                    gaugeShareOfInterest,
                    1e-13 ether,
                    18,
                    "Liquidity provider should have earned the rewards from the Curve gauges"
                );
            }
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
            _closeTroveFromCollateral(i, borrower, 0, false);
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
            _closeTroveFromCollateral(i, leverageSeeker, 0, true);
        }
    }

    function test_ManagerOfCurveGauge_UnlessRenounced_CanReassignRewardDistributor() external {
        vm.skip(address(curveUsdcBoldGauge) == address(0));

        address manager = curveUsdcBoldGauge.manager();
        vm.skip(manager == address(0));
        vm.label(manager, "manager");

        address newRewardDistributor = makeAddr("newRewardDistributor");
        uint256 rewardAmount = 10_000 ether;
        _openTrove(0, newRewardDistributor, 0, rewardAmount);

        vm.startPrank(newRewardDistributor);
        boldToken.approve(address(curveUsdcBoldGauge), rewardAmount);
        vm.expectRevert();
        curveUsdcBoldGauge.deposit_reward_token(BOLD, rewardAmount, 7 days);
        vm.stopPrank();

        vm.prank(manager);
        curveUsdcBoldGauge.set_reward_distributor(BOLD, newRewardDistributor);

        vm.startPrank(newRewardDistributor);
        curveUsdcBoldGauge.deposit_reward_token(BOLD, rewardAmount, 7 days);
        vm.stopPrank();
    }
}
