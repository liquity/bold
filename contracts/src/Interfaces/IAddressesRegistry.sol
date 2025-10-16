// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IActivePool.sol";
import "./IBoldToken.sol";
import "./IBorrowerOperations.sol";
import "./ICollSurplusPool.sol";
import "./IDefaultPool.sol";
import "./IHintHelpers.sol";
import "./IMultiTroveGetter.sol";
import "./ISortedTroves.sol";
import "./IStabilityPool.sol";
import "./ITroveManager.sol";
import "./ITroveNFT.sol";
import {IMetadataNFT} from "../NFTMetadata/MetadataNFT.sol";
import "./ICollateralRegistry.sol";
import "./IInterestRouter.sol";
import "./IPriceFeed.sol";

interface IAddressesRegistry {
    struct AddressVars {
        IERC20Metadata collToken;
        IBorrowerOperations borrowerOperations;
        ITroveManager troveManager;
        ITroveNFT troveNFT;
        IMetadataNFT metadataNFT;
        IStabilityPool stabilityPool;
        IPriceFeed priceFeed;
        IActivePool activePool;
        IDefaultPool defaultPool;
        address gasPoolAddress;
        ICollSurplusPool collSurplusPool;
        ISortedTroves sortedTroves;
        IInterestRouter interestRouter;
        IHintHelpers hintHelpers;
        IMultiTroveGetter multiTroveGetter;
        ICollateralRegistry collateralRegistry;
        IBoldToken boldToken;
        IERC20Metadata gasToken;
        address liquidityStrategy;
    }

    function collToken() external view returns (IERC20Metadata);
    function borrowerOperations() external view returns (IBorrowerOperations);
    function troveManager() external view returns (ITroveManager);
    function troveNFT() external view returns (ITroveNFT);
    function metadataNFT() external view returns (IMetadataNFT);
    function stabilityPool() external view returns (IStabilityPool);
    function priceFeed() external view returns (IPriceFeed);
    function activePool() external view returns (IActivePool);
    function defaultPool() external view returns (IDefaultPool);
    function gasPoolAddress() external view returns (address);
    function collSurplusPool() external view returns (ICollSurplusPool);
    function sortedTroves() external view returns (ISortedTroves);
    function interestRouter() external view returns (IInterestRouter);
    function hintHelpers() external view returns (IHintHelpers);
    function multiTroveGetter() external view returns (IMultiTroveGetter);
    function collateralRegistry() external view returns (ICollateralRegistry);
    function boldToken() external view returns (IBoldToken);
    function gasToken() external view returns (IERC20Metadata);
    function liquidityStrategy() external view returns (address);

    function setAddresses(AddressVars memory _vars) external;
}