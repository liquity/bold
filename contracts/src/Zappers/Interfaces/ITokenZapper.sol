// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITokenZapper {
    struct OpenTroveParams {
        address owner;
        uint256 ownerIndex;
        uint256 collAmount;
        uint256 boldAmount;
        uint256 upperHint;
        uint256 lowerHint;
        uint256 annualInterestRate;
        address batchManager;
        uint256 maxUpfrontFee;
        address addManager;
        address removeManager;
        address receiver;
    }

    function openTroveWithToken(OpenTroveParams calldata _params) external payable returns (uint256);

    function addCollWithToken(uint256 _troveId, uint256 tokenAmount) external; 
    function withdrawCollToToken(uint256 _troveId, uint256 _amount) external;
    function withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) external;
    function repayBold(uint256 _troveId, uint256 _boldAmount) external;
    function adjustTroveWithToken(
        uint256 _troveId,
        uint256 _collChange, // underlying token decimals
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external;
    function closeTroveToUnderlyingToken(uint256 _troveId) external;
    function adjustZombieTroveWithToken(
        uint256 _troveId,
        uint256 _collChange, // underlying token decimals
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external payable;
}
