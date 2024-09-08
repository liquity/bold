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

    // not marked as view but it is almost one... updates a single state field lastBoldLossError_Offset
    function StabilityPool._computeCollRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalBoldDeposits
    ) internal returns (uint, uint) => NONDET;

    // I think it's okay to ignore gas compensations in the first step
    function TroveManager._sendGasCompensation(address _activePool, address _liquidator, uint _bold, uint _ETH) internal => NONDET;
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
