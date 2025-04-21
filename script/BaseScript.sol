// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import { strings } from "./utils/strings.sol";
import { Create2 } from "./utils/Create2.sol";
import { ICreateX } from "./utils/ICreateX.sol";

abstract contract BaseScript is Script {
  type CreateXSeed is bytes32;

  using strings for string;
  using strings for strings.slice;

  struct Deployment {
    address contractAddress;
    string contractName;
  }

  struct ChainConfig {
    uint256 chainId;
    string name;
    uint256 testnetChainId;
    string testnetName;
  }

  struct ChainMetadata {
    string name;
    uint256 chainId;
    bool isTestnet;
  }

  ICreateX private constant CREATE_X_FACTORY =
    ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

  string private constant PATH_CONFIG = "/script/config/";
  string private constant ENV_PRIVATE_KEY = "DEPLOYER_PRIVATE_KEY";
  string private constant ENV_PRIVATE_LOCAL_KEY = "DEPLOYER_PRIVATE_LOCAL_KEY";
  string private constant ENV_PRIVATE_TESTNET_KEY = "DEPLOYER_PRIVATE_TESTNET_KEY";
  string private constant ENV_DEPLOY_NETWORK = "DEPLOY_NETWORK";
  string private constant DEPLOY_HISTORY_PATH = "/deployment/";
  string private constant KEY_CONTRACT_NAME = "contractName";
  string private constant CHAINS_CONFIG_FILE_NAME = "Chains";
  string private constant LOCAL_HOST_NETWORK_NAME = "localhost";

  mapping(string => address) internal contracts;
  mapping(string => mapping(string => address)) internal contractsOtherNetworks;
  mapping(uint256 => ChainMetadata) internal chainMetadata;

  constructor() {
    _loadChains();
    _loadDeployedContracts(false);
  }

  function _loadChains() private {
    ChainConfig[] memory chainConfigs =
      abi.decode(vm.parseJson(_getConfig(CHAINS_CONFIG_FILE_NAME)), (ChainConfig[]));

    ChainConfig memory indexChainConfig;

    for (uint256 i = 0; i < chainConfigs.length; ++i) {
      indexChainConfig = chainConfigs[i];

      chainMetadata[indexChainConfig.chainId] =
        ChainMetadata(indexChainConfig.name, indexChainConfig.chainId, false);

      chainMetadata[indexChainConfig.testnetChainId] =
        ChainMetadata(indexChainConfig.testnetName, indexChainConfig.testnetChainId, true);
    }
  }

  /**
   * @notice _loadDeployedContractsInSimulation - Load deployed contracts in simulation
   * too.
   */
  function _loadDeployedContractsInSimulation() internal {
    _loadDeployedContracts(true);
  }

  function _loadDeployedContracts(bool _loadInSimulation) private {
    if (!_loadInSimulation && _isSimulation()) return;

    Deployment[] memory deployments = _getDeployedContracts(_getNetwork());

    Deployment memory cached;
    uint256 length = deployments.length;
    for (uint256 i = 0; i < length; ++i) {
      cached = deployments[i];
      contracts[cached.contractName] = cached.contractAddress;
      vm.label(cached.contractAddress, cached.contractName);
    }
  }

  //Entrypoint for the script
  function run() external virtual;

  //More info:
  // https://github.com/pcaversaccio/createx/blob/776c97635c9d592e8a866e25f15d45b374892cf1/src/CreateX.sol#L873-L912
  function _generateSeed(uint88 _id) internal view returns (CreateXSeed) {
    if (_id == 0) revert("`_id` cannot be zero for seed");
    return CreateXSeed.wrap(
      bytes32(abi.encodePacked(_getDeployerAddress(), hex"00", bytes11(_id)))
    );
  }

  /**
   * _tryDeployContractDeterministic() Deploy Contract using Create3 Factory
   * @param _name Name that it will be saved under
   * @param _createXSeedFormat Salt of the contract, use _generateSeed() to generate
   * @param _creationCode type(MyContract).creationCode
   * @param _args abi.encode(...args...)
   * @return contract_ Contract Address
   * @return isAlreadyExisting_ If it was already deployed or not
   */
  function _tryDeployContractDeterministic(
    string memory _name,
    CreateXSeed _createXSeedFormat,
    bytes memory _creationCode,
    bytes memory _args
  ) internal returns (address contract_, bool isAlreadyExisting_) {
    contract_ = contracts[_name];
    if (address(contract_) != address(0)) return (contract_, true);

    vm.broadcast(_getDeployerPrivateKey());
    contract_ = CREATE_X_FACTORY.deployCreate3(
      CreateXSeed.unwrap(_createXSeedFormat), abi.encodePacked(_creationCode, _args)
    );

    _saveDeployment(_name, contract_);
    return (contract_, false);
  }

  /**
   * _tryDeployContractCREATE2() Deploy Contract using Create2
   * @param _name Name that it will be saved under
   * @param _salt Salt of the contract
   * @param _creationCode type(MyContract).creationCode
   * @param _args abi.encode(...args...)
   * @return contract_ Contract Address
   * @return isAlreadyExisting_ If it was already deployed or not
   * @dev `_salt` can not be used twice for the same bytecode
   */
  function _tryDeployContractCREATE2(
    string memory _name,
    bytes32 _salt,
    bytes memory _creationCode,
    bytes memory _args
  ) internal returns (address contract_, bool isAlreadyExisting_) {
    contract_ = contracts[_name];
    if (address(contract_) != address(0)) return (contract_, true);

    vm.broadcast(_getDeployerPrivateKey());
    contract_ = Create2.deploy(0, _salt, abi.encodePacked(_creationCode, _args));

    _saveDeployment(_name, contract_);

    return (contract_, false);
  }

  /**
   * _tryDeployContract() Deploy Contract using Create
   * @param _name Name that it will be saved under
   * @param _creationCode type(MyContract).creationCode
   * @param _args abi.encode(...args...)
   * @return contract_ Contract Address
   * @return isAlreadyExisting_ If it was already deployed or not
   */
  function _tryDeployContract(
    string memory _name,
    uint256 _amount,
    bytes memory _creationCode,
    bytes memory _args
  ) internal returns (address contract_, bool isAlreadyExisting_) {
    contract_ = contracts[_name];
    if (address(contract_) != address(0)) return (contract_, true);

    bytes memory _code = abi.encodePacked(_creationCode, _args);

    vm.broadcast(_getDeployerPrivateKey());
    assembly {
      contract_ := create(_amount, add(_code, 0x20), mload(_code))
    }

    require(contract_ != address(0), "deploy failed");

    _saveDeployment(_name, contract_);
    return (contract_, false);
  }

  /**
   * @notice _getNetwork the current chain network's name.
   */
  function _getNetwork() internal view returns (string memory) {
    return chainMetadata[block.chainid].name;
  }

  /**
   * @notice _saveDeployment - Get config file from "/script/config/`_fileName`.json
   * @param _contractName the name of the contract (what will be shown inside the
   * /deployments/ file)
   * @param _contractAddress the address of the contract
   * @dev If the `_contractName` already exists, it will not save it again
   * @dev Simulation broadcast will also save inside the deployments file. I haven't find
   * a way to detect simulations
   * yet
   */
  function _saveDeployment(string memory _contractName, address _contractAddress)
    internal
  {
    vm.label(_contractAddress, _contractName);
    if (_isSimulation()) return;

    string memory json = "NewDeployment";
    string memory insertData;

    vm.serializeString(json, "contractName", _contractName);
    string memory output = vm.serializeAddress(json, "contractAddress", _contractAddress);

    string memory currentData = vm.readFile(_getDeploymentPath(_getNetwork()));
    strings.slice memory slicedCurrentData = currentData.toSlice();

    if (contracts[_contractName] != address(0)) {
      console.log(_contractName, "Already exists");
      return;
    }

    if (slicedCurrentData.contains(KEY_CONTRACT_NAME.toSlice())) {
      insertData = _addContractToString(currentData, output);
    } else {
      insertData = string.concat("[", output);
      insertData = string.concat(insertData, "]");
    }

    vm.writeJson(insertData, _getDeploymentPath(_getNetwork()));

    contracts[_contractName] = _contractAddress;
  }

  function _addContractToString(string memory _currentData, string memory _contractData)
    private
    pure
    returns (string memory modifiedData_)
  {
    string memory f = "}";

    strings.slice memory sliceDatas = _currentData.toSlice();
    strings.slice memory needle = f.toSlice();

    modifiedData_ = sliceDatas.copy().rfind(needle).toString();

    modifiedData_ = string.concat(modifiedData_, ",");
    modifiedData_ = string.concat(modifiedData_, _contractData);
    modifiedData_ = string.concat(modifiedData_, "]");

    return modifiedData_;
  }

  /**
   * @notice _getConfig - Get config file from "/script/config/`_fileName`.json
   * @param _fileName the name of the config file (without extension)
   * @return fileData_ Raw data of the file. use vm.parseJson(fileData_, jsonKey) to get
   * the json encoded data
   */
  function _getConfig(string memory _fileName) internal view returns (string memory) {
    string memory inputDir = string.concat(vm.projectRoot(), PATH_CONFIG);
    string memory file = string.concat(_fileName, ".json");
    return vm.readFile(string.concat(inputDir, file));
  }

  function _getDeployerAddress() internal view returns (address) {
    return vm.addr(_getDeployerPrivateKey());
  }
  /**
   * @notice _getDeployerPrivateKey - Get the deployer with the private key inside .env
   * @return deployerPrivateKey deployer private key
   */

  function _getDeployerPrivateKey() internal view returns (uint256) {
    if (_isLocal()) {
      return vm.envUint(ENV_PRIVATE_LOCAL_KEY);
    }

    return vm.envUint(_isTestnet() ? ENV_PRIVATE_TESTNET_KEY : ENV_PRIVATE_KEY);
  }

  function _isTestnet() internal view returns (bool) {
    return chainMetadata[block.chainid].isTestnet;
  }

  function _isLocal() internal view returns (bool) {
    bytes32 currentNetwork = keccak256(abi.encode(_getNetwork()));
    bytes32 localNetwork = keccak256(abi.encode(LOCAL_HOST_NETWORK_NAME));

    return currentNetwork == localNetwork;
  }

  /**
   * @notice _loadOtherContractNetwork - Loads the deployed contracts from a network
   * inside the mapping "contractsOtherNetworks"
   * @param _loadInSimulation If it should load in simulation
   * @param _network the name of the network
   */
  function _loadOtherContractNetwork(bool _loadInSimulation, string memory _network)
    internal
  {
    if (!_loadInSimulation && _isSimulation()) return;

    Deployment[] memory deployments = _getDeployedContracts(_network);

    Deployment memory cached;
    uint256 length = deployments.length;
    for (uint256 i = 0; i < length; ++i) {
      cached = deployments[i];
      contractsOtherNetworks[_network][cached.contractName] = cached.contractAddress;
      vm.label(cached.contractAddress, cached.contractName);
    }
  }

  /**
   * @notice _getDeployedContracts - Gets the deployed contracts from a specific network
   * @param _network the name of the network
   * @return deployments_ Array of Deployment[] Structure
   */
  function _getDeployedContracts(string memory _network)
    internal
    view
    returns (Deployment[] memory deployments_)
  {
    bytes memory json = _getDeployedContractsJson(_network);

    if (keccak256(json) == keccak256("")) return deployments_;

    return abi.decode(json, (Deployment[]));
  }

  /**
   * @notice _getDeployedContractsJson - Gets the Encoded Json of the deployment file
   * @param _network the name of the network
   * @return jsonBytes_ Encoded version of the json
   */
  function _getDeployedContractsJson(string memory _network)
    private
    view
    returns (bytes memory jsonBytes_)
  {
    string memory fileData = vm.readFile(_getDeploymentPath(_network));

    if (fileData.toSlice().empty()) return jsonBytes_;

    return vm.parseJson(fileData);
  }

  function _getDeploymentPath(string memory _network)
    private
    view
    returns (string memory)
  {
    string memory root = vm.projectRoot();
    string memory path = string.concat(root, DEPLOY_HISTORY_PATH);
    string memory file = string.concat(_network, ".json");

    return string.concat(path, file);
  }

  function _isNull(address _a) internal pure returns (bool) {
    return _a == address(0);
  }

  function _isSimulation() internal view returns (bool) {
    return vm.isContext(VmSafe.ForgeContext.ScriptDryRun);
  }
}
