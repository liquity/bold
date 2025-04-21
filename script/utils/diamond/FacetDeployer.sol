// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "script/BaseScript.sol";
import { DiamondHelper } from "./DiamondHelper.sol";
import { IDiamondCut } from "./IDiamondCut.sol";

abstract contract FacetDeployerScript is BaseScript, DiamondHelper {
  string internal FACET_NAME;
  string internal FACET_INTERFACE;

  constructor(string memory _facetName, string memory _facetInterfaceName) {
    FACET_NAME = _facetName;
    FACET_INTERFACE = _facetInterfaceName;
  }

  function run() external override {
    tryToDeploy(contracts[FACET_NAME]);
  }

  function tryToDeploy() external returns (address) {
    return tryToDeploy(contracts[FACET_NAME]);
  }

  function tryToDeploy(address _cachedContract) public virtual returns (address);

  function getFacetCuts() external view returns (IDiamondCut.FacetCut[] memory) {
    address facet = contracts[FACET_NAME];
    require(facet != address(0), "Facet not deployed.");

    return _generateCuts(FACET_INTERFACE, facet);
  }
}
