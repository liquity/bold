// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import { IERC20Metadata } from
  "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IAddressesRegistry } from "src/Interfaces/IAddressesRegistry.sol";
import { IActivePool } from "src/Interfaces/IActivePool.sol";
import { IBorrowerOperations } from "src/Interfaces/IBorrowerOperations.sol";
import { ICollSurplusPool } from "src/Interfaces/ICollSurplusPool.sol";
import { IDefaultPool } from "src/Interfaces/IDefaultPool.sol";
import { ISortedTroves } from "src/Interfaces/ISortedTroves.sol";
import { IStabilityPool } from "src/Interfaces/IStabilityPool.sol";
import { ITroveManager } from "src/Interfaces/ITroveManager.sol";
import { ITroveNFT } from "src/Interfaces/ITroveNFT.sol";
import { IPriceFeed } from "src/Interfaces/IPriceFeed.sol";
import { IInterestRouter } from "src/Interfaces/IInterestRouter.sol";
import { MetadataNFT } from "src/NFTMetadata/MetadataNFT.sol";

abstract contract DeployHelper {
  struct Config {
    address owner;
    address wSonic;
    address usdc;
    address lBTC;
    address sonicOracleContract;
  }

  struct ScriptMetadata {
    address boldToken;
    address wSonic;
    address usdc;
    address lBTC;
    address stakingProtocolToken;
  }

  struct TroveManagerParams {
    uint256 CCR;
    uint256 MCR;
    uint256 SCR;
    uint256 BCR;
    uint256 LIQUIDATION_PENALTY_SP;
    uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
  }

  struct LiquityContracts {
    IAddressesRegistry addressesRegistry;
    IActivePool activePool;
    IBorrowerOperations borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManager troveManager;
    ITroveNFT troveNFT;
    MetadataNFT metadataNFT;
    IPriceFeed priceFeed;
    IInterestRouter interestRouter;
    IERC20Metadata collToken;
  }

  struct LiquityContractAddresses {
    address activePool;
    address borrowerOperations;
    address collSurplusPool;
    address defaultPool;
    address sortedTroves;
    address stabilityPool;
    address troveManager;
    address troveNFT;
    address metadataNFT;
    address priceFeed;
    address gasPool;
    address interestRouter;
  }

  string private constant CONTRACT_BOLD_NAME = "Bold";
  string private constant CONTRACT_WSONIC_TESTNET_NAME = "WSONIC";
  string private constant CONTRACT_USDC_TESTNET_NAME = "USDC";
  string private constant CONTRACT_LBTC_TESTNET_NAME = "LBTC";
}
