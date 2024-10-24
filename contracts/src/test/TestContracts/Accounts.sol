// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "forge-std/Test.sol";

contract Accounts {
    // Private keys for first 10 Hardhat test accounts
    uint256[10] public accountsPks = [
        0x60ddFE7f579aB6867cbE7A2Dc03853dC141d7A4aB6DBEFc0Dae2d2B1Bd4e487F,
        0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9,
        0x8b693607Bd68C4dEB7bcF976a473Cf998BDE9fBeDF08e1D8ADadAcDff4e5D1b6,
        0x519B6e4f493e532a1BEbfeB2a06eA25AAD691A17875cCB38607D4A4C28DFADC2,
        0x09CFF53c181C96B42255ccbCEB2CeE7012A532EcbcEaaBab4d55a47E1874FbFC,
        0x054ce61b1eA12d9Edb667ceFB001FADB07FE0C37b5A74542BB0DaBF5DDeEe5f0,
        0x42F55f0dFFE4e9e2C2BdfdE2FF98f3d1ea6d3F21A8bB0dA644f1c0e0Acd84FA0,
        0x8F3aFFEC01e78ea6925De62d68A5F3f2cFda7D0C1E7ED9b20d31eb88b9Ed6A58,
        0xBeBeF90A7E9A8e018F0F0baBb868Bc432C5e7F1EfaAe7e5B465d74afDD87c7cf,
        0xaD55BABd2FdceD7aa85eB1FEf47C455DBB7a57a46a16aC9ACFFBE66d7Caf83Ee
    ];

    function getAccountsCount() external view returns (uint256) {
        return accountsPks.length;
    }
}

contract TestAccounts is Test {
    Accounts accounts;

    address[] accountsList;
    address public A;
    address public B;
    address public C;
    address public D;
    address public E;
    address public F;
    address public G;

    function createAccounts() public {
        address[10] memory tempAccounts;
        for (uint256 i = 0; i < accounts.getAccountsCount(); i++) {
            tempAccounts[i] = vm.addr(uint256(accounts.accountsPks(i)));
        }

        accountsList = tempAccounts;
    }
}
