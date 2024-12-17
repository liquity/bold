// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/PythUtils.sol";

import "../Dependencies/Ownable.sol";
import "../Interfaces/IPythPriceFeed.sol";
import "../BorrowerOperations.sol";

abstract contract PythPriceFeedBase is IPythPriceFeed, Ownable {
    struct PythCfg {
        IPyth pythContract;
        bytes32 feedId;
        uint256 ageThreshold;
    }

    struct PythResponse {
        int64 price;
        int32 expo;
        bool success;
    }

    error InsufficientGasForExternalCall();

    event ShutDownFromPythFailure(address _pythContract, bytes32 _failedFeedId);

    PriceSource public priceSource;
    uint256 public lastGoodPrice;
    PythCfg public pyth;
    IBorrowerOperations borrowerOperations;

    constructor(
        address _owner,
        address _pythContract,
        bytes32 _feedId,
        uint256 _ageThreshold
    ) Ownable(_owner) {
        pyth.pythContract = IPyth(_pythContract);
        pyth.feedId = _feedId;
        pyth.ageThreshold = _ageThreshold;
    }
    function setAddresses(address _borrowOperationsAddress) external onlyOwner {
        borrowerOperations = IBorrowerOperations(_borrowOperationsAddress);

        _renounceOwnership();
    }

    function _getOracleAnswer(
        PythCfg memory pythCfg
    ) internal view returns (uint256, bool) {
        PythResponse memory pythResponse = _getPythResponse(
            pythCfg.pythContract,
            pythCfg.feedId,
            pythCfg.ageThreshold
        );

        uint256 scaledPrice;
        bool pythIsDown;

        if (!_isValidPythPrice(pythResponse)) {
            pythIsDown = true;
        } else {
            scaledPrice = PythUtils.convertToUint(
                pythResponse.price,
                pythResponse.expo,
                18
            );
        }

        return (scaledPrice, pythIsDown);
    }

    function _shutDownAndSwitchToLastGoodPrice(
        address _failedPythContract,
        bytes32 _failedFeedId
    ) internal returns (uint256) {
        borrowerOperations.shutdownFromOracleFailure();
        priceSource = PriceSource.lastGoodPrice;
        emit ShutDownFromPythFailure(_failedPythContract, _failedFeedId);
        return lastGoodPrice;
    }

    function _getPythResponse(
        IPyth pythContract,
        bytes32 feedId,
        uint256 ageThreshold
    ) internal view returns (PythResponse memory pythResponse) {
        uint256 gasBefore = gasleft();

        try pythContract.getPriceNoOlderThan(feedId, ageThreshold) returns (
            PythStructs.Price memory price
        ) {
            pythResponse.price = price.price;
            pythResponse.expo = price.expo;
            pythResponse.success = true;
        } catch {
            if (gasleft() <= gasBefore / 64) {
                revert InsufficientGasForExternalCall();
            }
        }
    }

    function _isValidPythPrice(
        PythResponse memory pythResponse
    ) internal pure returns (bool) {
        return pythResponse.success && pythResponse.price > 0;
    }
}
