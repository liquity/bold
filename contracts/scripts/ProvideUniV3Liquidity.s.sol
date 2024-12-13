// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {ERC20Faucet} from "test/TestContracts/ERC20Faucet.sol";
import {WETHTester} from "test/TestContracts/WETHTester.sol";

import "src/Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Factory.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";

import "forge-std/console2.sol";

contract ProvideUniV3Liquidity is Script {
    uint256 constant DECIMAL_PRECISION = 1e18;

    uint24 constant UNIV3_FEE = 0.3e4;
    uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
    uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%
    ISwapRouter constant uniV3RouterSepolia = ISwapRouter(0x65669fE35312947050C450Bd5d36e6361F85eC12);
    IQuoterV2 constant uniV3QuoterSepolia = IQuoterV2(0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3);
    IUniswapV3Factory constant uniswapV3FactorySepolia = IUniswapV3Factory(0x0227628f3F023bb0B980b67D528571c95c6DaC1c);
    INonfungiblePositionManager constant uniV3PositionManagerSepolia =
        INonfungiblePositionManager(0x1238536071E1c677A632429e3655c799b22cDA52);

    WETHTester constant WETH = WETHTester(payable(0x3e8Bd35e898505EE0dD29277ee42eD92021C82aF));
    ERC20Faucet constant usdc = ERC20Faucet(0xF00ad39d0aC1A422DAB5A2EceBAa5268ea909aD4);
    ERC20Faucet constant wstETH = ERC20Faucet(0xC5958986793086593871f207975053cf66d0B764);
    ERC20Faucet constant rETH = ERC20Faucet(0x078c20A159eA4EdF8d029Fb21E6bd120455B4acc);

    address deployer;

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        console2.log(deployer, "deployer");
        console2.log(deployer.balance, "deployer balance");

        uint256 price = 2_000 ether;

        // WETH
        console2.log("WETH");
        uint256 token1Amount = 1_000_000 ether;
        _provideUniV3Liquidity(usdc, WETH, token1Amount, price, UNIV3_FEE_USDC_WETH);

        token1Amount = 1_000 ether;

        // wstETH
        console2.log("wstETH");
        _provideUniV3Liquidity(WETH, wstETH, token1Amount, 1 ether, UNIV3_FEE_WETH_COLL);

        // rETH
        console2.log("rETH");
        _provideUniV3Liquidity(WETH, rETH, token1Amount, 1 ether, UNIV3_FEE_WETH_COLL);
    }

    // _price should be _token1 / _token2
    function _provideUniV3Liquidity(
        ERC20Faucet _token1,
        ERC20Faucet _token2,
        uint256 _token1Amount,
        uint256 _price,
        uint24 _fee
    ) internal {
        // tokens and amounts
        uint256 token2Amount = _token1Amount * DECIMAL_PRECISION / _price;
        address[2] memory tokens;
        uint256[2] memory amounts;

        uint256 price;
        if (address(_token1) < address(_token2)) {
            tokens[0] = address(_token1);
            tokens[1] = address(_token2);
            amounts[0] = _token1Amount;
            amounts[1] = token2Amount;
            // inverse price if token1 goes first
            price = DECIMAL_PRECISION * DECIMAL_PRECISION / _price;
        } else {
            tokens[0] = address(_token2);
            tokens[1] = address(_token1);
            amounts[0] = token2Amount;
            amounts[1] = _token1Amount;
            price = _price;
        }

        uniV3PositionManagerSepolia.createAndInitializePoolIfNecessary(
            tokens[0],
            tokens[1],
            _fee,
            _priceToSqrtPrice(price) // sqrtPriceX96
        );

        // mint and approve
        _token1.mint(deployer, _token1Amount);
        _token2.mint(deployer, token2Amount);
        _token1.approve(address(uniV3PositionManagerSepolia), _token1Amount);
        _token2.approve(address(uniV3PositionManagerSepolia), token2Amount);

        // mint new position
        address uniV3PoolAddress = uniswapV3FactorySepolia.getPool(tokens[0], tokens[1], _fee);
        int24 TICK_SPACING = IUniswapV3Pool(uniV3PoolAddress).tickSpacing();
        (, int24 tick,,,,,) = IUniswapV3Pool(uniV3PoolAddress).slot0();
        int24 tickLower = (tick - 6000) / TICK_SPACING * TICK_SPACING;
        int24 tickUpper = (tick + 6000) / TICK_SPACING * TICK_SPACING;

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: tokens[0],
            token1: tokens[1],
            fee: _fee,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: amounts[0],
            amount1Desired: amounts[1],
            amount0Min: 0,
            amount1Min: 0,
            recipient: deployer,
            deadline: block.timestamp + 600 minutes
        });

        uniV3PositionManagerSepolia.mint(params);

        console2.log("--");
        console2.log(_token1.name());
        console2.log(address(_token1), "address(_token1)");
        console2.log(_token1Amount, "_token1Amount");
        console2.log(_token1.balanceOf(uniV3PoolAddress), "token1.balanceOf(pool)");
        console2.log(_token2.name());
        console2.log(address(_token2), "address(_token2)");
        console2.log(token2Amount, "token2Amount");
        console2.log(_token2.balanceOf(uniV3PoolAddress), "token2.balanceOf(pool)");
    }

    function _priceToSqrtPrice(uint256 _price) public pure returns (uint160) {
        return uint160(Math.sqrt((_price << 192) / DECIMAL_PRECISION));
    }
}
