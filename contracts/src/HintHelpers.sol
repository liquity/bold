// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

contract HintHelpers is LiquityBase, Ownable, CheckContract {
    string public constant NAME = "HintHelpers";

    ISortedTroves public sortedTroves;
    ITroveManager public troveManager;

    // --- Events ---

    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);

    // --- Dependency setters ---

    function setAddresses(address _sortedTrovesAddress, address _troveManagerAddress) external onlyOwner {
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
    function getApproxHint(uint256 _interestRate, uint256 _numTrials, uint256 _inputRandomSeed)
        external
        view
        returns (uint256 hintId, uint256 diff, uint256 latestRandomSeed)
    {
        uint256 arrayLength = troveManager.getTroveIdsCount();

        if (arrayLength == 0) {
            return (0, 0, _inputRandomSeed);
        }

        hintId = sortedTroves.getLast();
        diff = LiquityMath._getAbsoluteDifference(_interestRate, troveManager.getTroveAnnualInterestRate(hintId));
        latestRandomSeed = _inputRandomSeed;

        uint256 i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint256(keccak256(abi.encodePacked(latestRandomSeed)));

            uint256 arrayIndex = latestRandomSeed % arrayLength;
            uint256 currentId = troveManager.getTroveFromTroveIdsArray(arrayIndex);

            // Skip this Trove if it's unredeeamable and not in the sorted list
            if (!sortedTroves.contains(currentId)) continue;

            uint256 currentInterestRate = troveManager.getTroveAnnualInterestRate(currentId);

            // check if abs(current - IR) > abs(closest - IR), and update closest if current is closer
            uint256 currentDiff = LiquityMath._getAbsoluteDifference(currentInterestRate, _interestRate);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintId = currentId;
            }
            i++;
        }
    }
}
