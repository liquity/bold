// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";


contract HintHelpers is LiquityBase, Ownable, CheckContract {
    string constant public NAME = "HintHelpers";

    ISortedTroves public sortedTroves;
    ITroveManager public troveManager;

    // --- Events ---

    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _sortedTrovesAddress,
        address _troveManagerAddress
    )
        external
        onlyOwner
    {
        checkContract(_sortedTrovesAddress);
        checkContract(_troveManagerAddress);

        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        troveManager = ITroveManager(_troveManagerAddress);

        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    /* getApproxHint() - return id of a Trove that is, on average, (length / numTrials) positions away in the
    sortedTroves list from the correct insert position of the Trove to be inserted. 
    
    Note: The output id is worst-case O(n) positions away from the correct insert position, however, the function
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput id will
    be <= sqrt(length) positions away from the correct insert position.
    */
    function getApproxHint(uint _interestRate, uint _numTrials, uint _inputRandomSeed)
        external
        view
        returns (uint256 hintId, uint diff, uint latestRandomSeed)
    {
        uint arrayLength = troveManager.getTroveIdsCount();

        if (arrayLength == 0) {
            return (0, 0, _inputRandomSeed);
        }

        hintId = sortedTroves.getLast();
        diff = LiquityMath._getAbsoluteDifference(_interestRate, troveManager.getTroveAnnualInterestRate(hintId));
        latestRandomSeed = _inputRandomSeed;

        uint i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

            uint arrayIndex = latestRandomSeed % arrayLength;
            uint256 currentId = troveManager.getTroveFromTroveIdsArray(arrayIndex);
            uint currentInterestRate = troveManager.getTroveAnnualInterestRate(currentId);

            // check if abs(current - IR) > abs(closest - IR), and update closest if current is closer
            uint currentDiff = LiquityMath._getAbsoluteDifference(currentInterestRate, _interestRate);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintId = currentId;
            }
            i++;
        }
    }
}
