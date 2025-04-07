// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IZapper} from "../src/Zappers/Interfaces/IZapper.sol";

contract Tester is Test {
    IZapper public zapper;

    function setUp() public {
        vm.createSelectFork(
            "https://bnb-mainnet.g.alchemy.com/v2/KsuP431uPWKR3KFb-K_0MT1jcwpUnjAg"
        );
        zapper = IZapper(0xc8E0604c537F2cA73AF9AE069D0d34Dd8CF5f49F);
    }

    function test_tester() public {
        vm.startPrank(0x22f5413C075Ccd56D575A54763831C4c27A37Bdb);
        zapper.openTroveWithRawETH{value: 0.0375 ether}(
            IZapper.OpenTroveParams({
                owner: 0x22f5413C075Ccd56D575A54763831C4c27A37Bdb,
                ownerIndex: uint256(0),
                collAmount: uint256(708330000000000),
                boldAmount: 20 ether,
                upperHint: uint256(0),
                lowerHint: uint256(0),
                annualInterestRate: uint256(5000000000000000),
                batchManager: address(0),
                maxUpfrontFee: type(uint256).max,
                addManager: address(0),
                removeManager: address(0),
                receiver: address(0)
            })
        );
    }
}
