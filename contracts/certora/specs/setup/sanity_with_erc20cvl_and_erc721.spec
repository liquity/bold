import "../ERC20/erc20cvl.spec";
import "../ERC20/WETHcvl.spec";
import "../ERC721/erc721.spec";
import "../PriceAggregators/chainlink.spec";
import "../PriceAggregators/tellor.spec";
import "../setup/builtin_assertions.spec";
import "../generic.spec";
import "../optimizations.spec";

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
