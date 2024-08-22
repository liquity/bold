// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Script} from "forge-std/Script.sol";
import {Clones} from "openzeppelin-contracts/contracts/proxy/Clones.sol";
import {ERC20Faucet} from "../test/TestContracts/ERC20Faucet.sol";
import {IBorrowerOperations} from "../Interfaces/IBorrowerOperations.sol";
import {ICollateralRegistry} from "../Interfaces/ICollateralRegistry.sol";
import {IHintHelpers} from "../Interfaces/IHintHelpers.sol";
import {ISortedTroves} from "../Interfaces/ISortedTroves.sol";
import {ITroveManager} from "../Interfaces/ITroveManager.sol";
import {ITroveNFT} from "../Interfaces/ITroveNFT.sol";

import {
    ETH_GAS_COMPENSATION,
    MAX_ANNUAL_INTEREST_RATE,
    MIN_ANNUAL_INTEREST_RATE,
    MIN_INTEREST_RATE_CHANGE_PERIOD
} from "../Dependencies/Constants.sol";

function sqrt(uint256 y) pure returns (uint256 z) {
    if (y > 3) {
        z = y;
        uint256 x = y / 2 + 1;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    } else if (y != 0) {
        z = 1;
    }
}

contract Proxy {
    function tap(ERC20Faucet faucet) external {
        faucet.tap();
        faucet.transfer(msg.sender, faucet.balanceOf(address(this)));
    }

    function sweepTrove(ITroveNFT nft, uint256 troveId) external {
        nft.transferFrom(address(this), msg.sender, troveId);
    }
}

contract OpenTroves is Script {
    struct BranchContracts {
        ERC20Faucet collateral;
        ITroveManager troveManager;
        ISortedTroves sortedTroves;
        IBorrowerOperations borrowerOperations;
        ITroveNFT nft;
    }

    function _findHints(IHintHelpers hintHelpers, BranchContracts memory c, uint256 branch, uint256 interestRate)
        internal
        view
        returns (uint256 upperHint, uint256 lowerHint)
    {
        // Find approx hint (off-chain)
        (uint256 approxHint,,) = hintHelpers.getApproxHint({
            _collIndex: branch,
            _interestRate: interestRate,
            _numTrials: sqrt(100 * c.troveManager.getTroveIdsCount()),
            _inputRandomSeed: block.timestamp
        });

        // Find concrete insert position (off-chain)
        (upperHint, lowerHint) = c.sortedTroves.findInsertPosition(interestRate, approxHint, approxHint);
    }

    function run() external {
        vm.startBroadcast();

        ICollateralRegistry collateralRegistry = ICollateralRegistry(vm.envAddress("COLLATERAL_REGISTRY"));
        vm.label(address(collateralRegistry), "CollateralRegistry");
        IHintHelpers hintHelpers = IHintHelpers(vm.envAddress("HINT_HELPERS"));
        vm.label(address(hintHelpers), "HintHelpers");
        address proxyImplementation = address(new Proxy());
        vm.label(proxyImplementation, "ProxyImplementation");

        ERC20Faucet weth = ERC20Faucet(address(collateralRegistry.getToken(0))); // branch #0 is WETH
        uint256 numBranches = collateralRegistry.totalCollaterals();

        for (uint256 branch = 0; branch < numBranches; ++branch) {
            BranchContracts memory c;
            c.collateral = ERC20Faucet(address(collateralRegistry.getToken(branch)));
            vm.label(address(c.collateral), "ERC20Faucet");
            c.troveManager = collateralRegistry.getTroveManager(branch);
            vm.label(address(c.troveManager), "TroveManager");
            c.sortedTroves = c.troveManager.sortedTroves();
            vm.label(address(c.sortedTroves), "SortedTroves");
            c.borrowerOperations = c.troveManager.borrowerOperations();
            vm.label(address(c.borrowerOperations), "BorrowerOperations");
            c.nft = c.troveManager.troveNFT();
            vm.label(address(c.nft), "TroveNFT");

            if (c.borrowerOperations.getInterestBatchManager(msg.sender).maxInterestRate == 0) {
                // Register ourselves as batch manager, if we haven't
                c.borrowerOperations.registerBatchManager({
                    minInterestRate: uint128(MIN_ANNUAL_INTEREST_RATE),
                    maxInterestRate: uint128(MAX_ANNUAL_INTEREST_RATE),
                    currentInterestRate: 0.025 ether,
                    fee: 0.001 ether,
                    minInterestRateChangePeriod: MIN_INTEREST_RATE_CHANGE_PERIOD
                });
            }

            for (uint256 i = 1; i <= 4; ++i) {
                Proxy proxy = Proxy(Clones.clone(proxyImplementation));
                vm.label(address(proxy), "Proxy");

                proxy.tap(c.collateral);
                uint256 ethAmount = c.collateral.tapAmount() / 2;

                if (branch == 0) {
                    // collateral == WETH
                    c.collateral.approve(address(c.borrowerOperations), ethAmount + ETH_GAS_COMPENSATION);
                } else {
                    proxy.tap(weth);
                    c.collateral.approve(address(c.borrowerOperations), ethAmount);
                    weth.approve(address(c.borrowerOperations), ETH_GAS_COMPENSATION);
                }

                uint256 interestRate = i * 0.01 ether;
                (uint256 upperHint, uint256 lowerHint) = _findHints(hintHelpers, c, branch, interestRate);

                uint256 troveId = c.borrowerOperations.openTrove({
                    _owner: address(proxy),
                    _ownerIndex: 0,
                    _ETHAmount: ethAmount,
                    _boldAmount: 2_000 ether,
                    _upperHint: upperHint,
                    _lowerHint: lowerHint,
                    _annualInterestRate: interestRate,
                    _maxUpfrontFee: type(uint256).max, // we don't care about fee slippage
                    _addManager: address(0),
                    _removeManager: address(0),
                    _receiver: address(0)
                });

                proxy.sweepTrove(c.nft, troveId);
                c.collateral.transfer(address(0xdead), c.collateral.balanceOf(msg.sender));
                if (branch != 0) weth.transfer(address(0xdead), weth.balanceOf(msg.sender));

                if (i % 2 == 0) {
                    interestRate = c.troveManager.getLatestBatchData(msg.sender).annualInterestRate;
                    (upperHint, lowerHint) = _findHints(hintHelpers, c, branch, interestRate);

                    // Have every 2nd Trove delegate to us
                    c.borrowerOperations.setInterestBatchManager({
                        _troveId: troveId,
                        _newBatchManager: msg.sender,
                        _upperHint: upperHint,
                        _lowerHint: lowerHint,
                        _maxUpfrontFee: type(uint256).max // we don't care about fee slippage
                    });
                }
            }
        }
    }
}
