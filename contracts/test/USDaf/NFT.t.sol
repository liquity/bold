// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./Base.sol";

contract NFTTest is Base {

    function setUp() override public {
        super.setUp();
    }

    // troveManagerParamsArray[0] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // st-yBOLD
    // troveManagerParamsArray[1] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // scrvUSD
    // troveManagerParamsArray[2] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sUSDS
    // troveManagerParamsArray[3] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sfrxUSD
    // troveManagerParamsArray[4] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // tBTC
    // troveManagerParamsArray[5] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // WBTC
    function testNFTPic() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[5];

        IMetadataNFT.TroveData memory _troveData = IMetadataNFT.TroveData({
            _tokenId: 1,
            _owner: address(this),
            _collToken: address(_contracts.collToken),
            _boldToken: address(_deployment.boldToken),
            _collAmount: 0,
            _debtAmount: 0,
            _interestRate: 0,
            _status: ITroveManager.Status.active
        });

        string memory _uri = _contracts.metadataNFT.uri(_troveData);

        console.log("NFT URI: ", _uri);
        revert("af");
    }
}
