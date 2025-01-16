// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

import {Script} from "forge-std/Script.sol";

import {ICurveStableswapFactoryNG} from "V2-gov/src/interfaces/ICurveStableswapFactoryNG.sol";
import {ICurveStableswapNG} from "V2-gov/src/interfaces/ICurveStableswapNG.sol";
import {ILiquidityGauge} from "V2-gov/src/interfaces/ILiquidityGauge.sol";

import {IGovernance} from "V2-gov/src/interfaces/IGovernance.sol";

import {Governance} from "V2-gov/src/Governance.sol";
import {CurveV2GaugeRewards} from "V2-gov/src/CurveV2GaugeRewards.sol";

import "forge-std/console2.sol";

contract DeployGovernance is Script {
    using Strings for *;

    struct DeployGovernanceParams {
        address deployer;
        bytes32 salt;
        address stakingV1;
        address lqty;
        address lusd;
        address bold;
    }

    // Governance Constants
    uint128 private constant REGISTRATION_FEE = 1000e18;
    uint128 private constant REGISTRATION_THRESHOLD_FACTOR = 0.0001e18; // 0.01%
    uint128 private constant UNREGISTRATION_THRESHOLD_FACTOR = 1e18 + 1;
    uint16 private constant UNREGISTRATION_AFTER_EPOCHS = 4;
    uint128 private constant VOTING_THRESHOLD_FACTOR = 0.02e18;
    uint88 private constant MIN_CLAIM = 0;
    uint88 private constant MIN_ACCRUAL = 0;
    uint32 private constant EPOCH_DURATION = 7 days;
    uint32 private constant EPOCH_VOTING_CUTOFF = 6 days;

    // UniV4Donations Constants
    uint24 private constant FEE = 400;
    int24 constant MAX_TICK_SPACING = 32767;

    // CurveV2GaugeRewards Constants
    uint256 private constant DURATION = 7 days;

    // Contracts
    Governance private governance;
    address[] private initialInitiatives;
    CurveV2GaugeRewards private curveV2GaugeRewards;
    ILiquidityGauge private gauge;

    function deployGovernance(DeployGovernanceParams memory p, address _curveFactoryAddress, address _curvePoolAddress)
        internal
        returns (address, string memory)
    {
        (address governanceAddress, IGovernance.Configuration memory governanceConfiguration) =
            computeGovernanceAddressAndConfig(p);

        governance = new Governance{salt: p.salt}(
            p.lqty, p.lusd, p.stakingV1, p.bold, governanceConfiguration, p.deployer, initialInitiatives
        );

        assert(governanceAddress == address(governance));

        // Curve initiative
        if (block.chainid == 1) {
            // mainnet
            deployCurveV2GaugeRewards({
                _governance: governance,
                _bold: p.bold,
                _bribeToken: p.lqty, // TODO: this should be CRV
                _curveFactoryAddress: _curveFactoryAddress,
                _curvePoolAddress: _curvePoolAddress
            });

            // TODO: BOLD/LUSD pool
        }

        governance.registerInitialInitiatives{gas: 600000}(initialInitiatives);

        return (governanceAddress, _getGovernanceManifestJson(_curvePoolAddress, p.lqty));
    }

    function computeGovernanceAddress(DeployGovernanceParams memory p) internal view returns (address) {
        (address governanceAddress,) = computeGovernanceAddressAndConfig(p);
        return governanceAddress;
    }

    function computeGovernanceAddressAndConfig(DeployGovernanceParams memory p)
        internal
        view
        returns (address, IGovernance.Configuration memory)
    {
        IGovernance.Configuration memory governanceConfiguration = IGovernance.Configuration({
            registrationFee: REGISTRATION_FEE,
            registrationThresholdFactor: REGISTRATION_THRESHOLD_FACTOR,
            unregistrationThresholdFactor: UNREGISTRATION_THRESHOLD_FACTOR,
            unregistrationAfterEpochs: UNREGISTRATION_AFTER_EPOCHS,
            votingThresholdFactor: VOTING_THRESHOLD_FACTOR,
            minClaim: MIN_CLAIM,
            minAccrual: MIN_ACCRUAL,
            epochStart: block.timestamp - EPOCH_DURATION,
            /// @audit Ensures that `initialInitiatives` can be voted on
            epochDuration: EPOCH_DURATION,
            epochVotingCutoff: EPOCH_VOTING_CUTOFF
        });

        bytes memory bytecode = abi.encodePacked(
            type(Governance).creationCode,
            abi.encode(p.lqty, p.lusd, p.stakingV1, p.bold, governanceConfiguration, p.deployer, new address[](0))
        );

        address governanceAddress = vm.computeCreate2Address(p.salt, keccak256(bytecode));

        return (governanceAddress, governanceConfiguration);
    }

    function deployCurveV2GaugeRewards(
        IGovernance _governance,
        address _bold,
        address _bribeToken,
        address _curveFactoryAddress,
        address _curvePoolAddress
    ) private {
        ICurveStableswapFactoryNG curveFactory = ICurveStableswapFactoryNG(_curveFactoryAddress);
        ICurveStableswapNG curvePool = ICurveStableswapNG(_curvePoolAddress);
        gauge = ILiquidityGauge(curveFactory.deploy_gauge(address(curvePool)));

        curveV2GaugeRewards =
            new CurveV2GaugeRewards(address(_governance), _bold, _bribeToken, address(gauge), DURATION);

        // add BOLD as reward token
        gauge.add_reward(_bold, address(curveV2GaugeRewards));

        initialInitiatives.push(address(curveV2GaugeRewards));
    }

    function _getGovernanceDeploymentConstants() internal pure returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                string.concat('"REGISTRATION_FEE":"', uint256(REGISTRATION_FEE).toString(), '",'),
                string.concat(
                    '"REGISTRATION_THRESHOLD_FACTOR":"', uint256(REGISTRATION_THRESHOLD_FACTOR).toString(), '",'
                ),
                string.concat(
                    '"UNREGISTRATION_THRESHOLD_FACTOR":"', uint256(UNREGISTRATION_THRESHOLD_FACTOR).toString(), '",'
                ),
                string.concat('"UNREGISTRATION_AFTER_EPOCHS":"', uint256(UNREGISTRATION_AFTER_EPOCHS).toString(), '",'),
                string.concat('"VOTING_THRESHOLD_FACTOR":"', uint256(VOTING_THRESHOLD_FACTOR).toString(), '",'),
                string.concat('"MIN_CLAIM":"', uint256(MIN_CLAIM).toString(), '",'),
                string.concat('"MIN_ACCRUAL":"', uint256(MIN_ACCRUAL).toString(), '",'),
                string.concat('"EPOCH_DURATION":"', uint256(EPOCH_DURATION).toString(), '",'),
                string.concat('"EPOCH_VOTING_CUTOFF":"', uint256(EPOCH_VOTING_CUTOFF).toString(), '" ') // no comma
            ),
            "}"
        );
    }

    function _getGovernanceManifestJson(address _curvePoolAddress, address _lqty)
        internal
        view
        returns (string memory)
    {
        return string.concat(
            "{",
            string.concat(
                string.concat('"constants":', _getGovernanceDeploymentConstants(), ","),
                string.concat('"governance":"', address(governance).toHexString(), '",'),
                string.concat('"curveV2GaugeRewardsInitiative":"', address(curveV2GaugeRewards).toHexString(), '",'),
                string.concat('"curvePool":"', _curvePoolAddress.toHexString(), '",'),
                string.concat('"gauge":"', address(gauge).toHexString(), '",'),
                string.concat('"LQTYToken":"', _lqty.toHexString(), '" ') // no comma
            ),
            "}"
        );
    }
}
