import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "./ERC721/erc721.spec";
import "./PriceAggregators/tellor.spec";
import "./setup/builtin_assertions.spec";
import "./generic.spec";

// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    // function SortedTroves.insertIntoBatch(
    //     uint256 _troveId,
    //     SortedTroves.BatchId _batchId,
    //     uint256 _annualInterestRate,
    //     uint256 _prevId,
    //     uint256 _nextId
    // ) external => NONDET;

    function SortedTroves.insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external => NONDET;

    // Without this, sanity will timeout. https://certora.atlassian.net/browse/CERT-7097
    // With the 2 explicit summarizations above, sanity will fail. https://certora.atlassian.net/browse/CERT-7108
    function SortedTroves._ external => NONDET;
}

use builtin rule sanity filtered { f -> f.contract == currentContract }

use rule check_builtin_assertions filtered { f -> f.contract == currentContract }

use builtin rule hasDelegateCalls filtered { f -> f.contract == currentContract }
use builtin rule msgValueInLoopRule;
use builtin rule viewReentrancy;
use rule privilegedOperation filtered { f -> f.contract == currentContract }
use rule timeoutChecker filtered { f -> f.contract == currentContract }
use rule simpleFrontRunning filtered { f -> f.contract == currentContract }
use rule noRevert filtered { f -> f.contract == currentContract }
use rule alwaysRevert filtered { f -> f.contract == currentContract }
