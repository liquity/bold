// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import { strings } from "../strings.sol";
import { IDiamondCut } from "./IDiamondCut.sol";

contract DiamondHelper is Script {
  using strings for string;
  using strings for strings.slice;

  string private constant KEY_TO_FIND_SELECTORS = ".methodIdentifiers[*]";

  /**
   * @notice Generate the facet cuts for a given interface's name and implementation
   * @param _interfaceName The name of the interface class
   * @param _implementation The address of the implementation
   * @return cuts_ The facet cuts
   */
  function _generateCuts(string memory _interfaceName, address _implementation)
    internal
    view
    returns (IDiamondCut.FacetCut[] memory cuts_)
  {
    address[] memory interfaces = new address[](1);
    string[] memory interfaceNames = new string[](1);

    interfaces[0] = _implementation;
    interfaceNames[0] = _interfaceName;

    return _generateAllCuts(interfaceNames, interfaces);
  }

  /**
   * @notice Generate the facet cuts for a given interface's name and implementation
   * @param _interfaceNames The names of the interface classes
   * @param _implementations The addresses of the implementations
   * @return cuts_ The facet cuts
   */
  function _generateAllCuts(
    string[] memory _interfaceNames,
    address[] memory _implementations
  ) internal view returns (IDiamondCut.FacetCut[] memory cuts_) {
    cuts_ = new IDiamondCut.FacetCut[](_implementations.length);

    address currentInterface;

    bytes4[] memory selectors;
    for (uint256 i = 0; i < _implementations.length;) {
      currentInterface = _implementations[i];
      selectors = _getSelectors(_interfaceNames[i]);

      if (selectors.length == 0) continue;

      cuts_[i] = IDiamondCut.FacetCut({
        facetAddress: currentInterface,
        action: IDiamondCut.FacetCutAction.Add,
        functionSelectors: selectors
      });

      unchecked {
        ++i;
      }
    }

    return cuts_;
  }

  /**
   * @notice Get the selectors for a given interface
   * @param interfaceName The name of the interface's class
   * @return selectors_ The selectors
   */
  function _getSelectors(string memory interfaceName)
    internal
    view
    returns (bytes4[] memory selectors_)
  {
    string memory inputDir = string.concat(vm.projectRoot(), "/out/");
    inputDir = string.concat(inputDir, interfaceName);
    inputDir = string.concat(inputDir, ".sol/");

    string memory file = string.concat(interfaceName, ".json");
    string memory json = vm.readFile(string.concat(inputDir, file));

    string[] memory selectorsString = new string[](1);
    bytes memory selectors = stdJson.parseRaw(json, KEY_TO_FIND_SELECTORS);

    try this.decodeSelectors(selectors) returns (string[] memory return_) {
      selectorsString = return_;
    } catch {
      selectorsString[0] = abi.decode(selectors, (string));
    }

    selectors_ = new bytes4[](selectorsString.length);
    for (uint256 i = 0; i < selectorsString.length; ++i) {
      selectors_[i] = bytes4(fromHex(selectorsString[i]));
    }

    if (selectors_.length == 1 && selectors_[0] == 0x0) {
      return new bytes4[](0);
    }

    return selectors_;
  }

  function fromHex(string memory s) private pure returns (bytes memory) {
    bytes memory ss = bytes(s);
    require(ss.length % 2 == 0); // length must be even
    bytes memory r = new bytes(ss.length / 2);
    for (uint256 i = 0; i < ss.length / 2; ++i) {
      r[i] =
        bytes1(fromHexChar(uint8(ss[2 * i])) * 16 + fromHexChar(uint8(ss[2 * i + 1])));
    }
    return r;
  }

  function fromHexChar(uint8 c) private pure returns (uint8) {
    if (bytes1(c) >= bytes1("0") && bytes1(c) <= bytes1("9")) {
      return c - uint8(bytes1("0"));
    }
    if (bytes1(c) >= bytes1("a") && bytes1(c) <= bytes1("f")) {
      return 10 + c - uint8(bytes1("a"));
    }
    if (bytes1(c) >= bytes1("A") && bytes1(c) <= bytes1("F")) {
      return 10 + c - uint8(bytes1("A"));
    }
    revert("fail");
  }

  /**
   * @notice Decode the selectors
   * @param _selectors The selectors
   * @return selectors_ The selectors
   * @dev This function is external to be able try-catch on execution
   */
  function decodeSelectors(bytes memory _selectors)
    external
    pure
    returns (string[] memory)
  {
    return abi.decode(_selectors, (string[]));
  }

  function _concatFacetCuts(
    IDiamondCut.FacetCut[] memory _a,
    IDiamondCut.FacetCut[] memory _b
  ) internal pure returns (IDiamondCut.FacetCut[] memory concated_) {
    concated_ = new IDiamondCut.FacetCut[](_a.length + _b.length);

    for (uint256 i = 0; i < _a.length; ++i) {
      concated_[i] = _a[i];
    }

    for (uint256 i = 0; i < _b.length; ++i) {
      concated_[i + _a.length] = _b[i];
    }

    return concated_;
  }
}
