// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {stdMath} from "forge-std/StdMath.sol";
import {IERC20Metadata as IERC20} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ICurveStableswapNGPool} from "../src/Zappers/Modules/Exchanges/Curve/ICurveStableswapNGPool.sol";
import {IQuoterV2} from "../src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import {ISwapRouter} from "../src/Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import {HybridCurveUniV3ExchangeHelpersV2} from "../src/Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpersV2.sol";
import {IExchange} from "../src/Zappers/Interfaces/IExchange.sol";
import {IExchangeHelpersV2} from "../src/Zappers/Interfaces/IExchangeHelpersV2.sol";
import {UseDeployment} from "./Utils/UseDeployment.sol";

library Bytes {
    function slice(bytes memory array, uint256 start) internal pure returns (bytes memory sliced) {
        sliced = new bytes(array.length - start);

        for (uint256 i = 0; i < sliced.length; ++i) {
            sliced[i] = array[start + i];
        }
    }
}

library BytesArray {
    function clone(bytes[] memory array) internal pure returns (bytes[] memory cloned) {
        cloned = new bytes[](array.length);

        for (uint256 i = 0; i < array.length; ++i) {
            cloned[i] = array[i];
        }
    }

    function reverse(bytes[] memory array) internal pure returns (bytes[] memory) {
        for ((uint256 i, uint256 j) = (0, array.length - 1); i < j; (++i, --j)) {
            (array[i], array[j]) = (array[j], array[i]);
        }

        return array;
    }

    function join(bytes[] memory array) internal pure returns (bytes memory joined) {
        for (uint256 i = 0; i < array.length; ++i) {
            joined = bytes.concat(joined, array[i]);
        }
    }
}

contract ExchangeHelpersTest is Test, UseDeployment {
    using Bytes for bytes;
    using BytesArray for bytes[];

    uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
    uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%

    IQuoterV2 constant uniV3Quoter = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
    ISwapRouter constant uniV3Router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

    mapping(address collToken => IExchange) exchange;
    IExchangeHelpersV2 exchangeHelpersV2;

    error QuoteResult(uint256 amount);

    function setUp() external {
        string memory rpcUrl = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) vm.skip(true);

        uint256 forkBlock = vm.envOr("FORK_BLOCK", uint256(0));
        if (forkBlock != 0) {
            vm.createSelectFork(rpcUrl, forkBlock);
        } else {
            vm.createSelectFork(rpcUrl);
        }

        _loadDeploymentFromManifest("addresses/1.json");

        for (uint256 i = 0; i < branches.length; ++i) {
            address collToken = address(branches[i].collToken);
            exchange[collToken] = branches[i].zapper.exchange();
        }

        exchangeHelpersV2 = new HybridCurveUniV3ExchangeHelpersV2({
            _usdc: USDC,
            _weth: WETH,
            _curvePool: ICurveStableswapNGPool(address(curveUsdcBold)),
            _usdcIndex: int8(curveUsdcBold.coins(0) == USDC ? 0 : 1),
            _boldIndex: int8(curveUsdcBold.coins(0) == BOLD ? 0 : 1),
            _feeUsdcWeth: UNIV3_FEE_USDC_WETH,
            _feeWethColl: UNIV3_FEE_WETH_COLL,
            _uniV3Quoter: uniV3Quoter
        });
    }

    function test_Curve_CanQuoteApproxDx(bool zeroToOne, uint256 dyExpected) external {
        (int128 i, int128 j) = zeroToOne ? (int128(0), int128(1)) : (int128(1), int128(0));
        (address inputToken, address outputToken) = (curveUsdcBold.coins(uint128(i)), curveUsdcBold.coins(uint128(j)));
        uint256 dyDecimals = IERC20(outputToken).decimals();
        uint256 dyDiv = 10 ** (18 - dyDecimals);
        dyExpected = bound(dyExpected, 1 ether / dyDiv, 1_000_000 ether / dyDiv);

        uint256 dx = curveUsdcBold.get_dx(i, j, dyExpected);
        vm.assume(dx > 0); // For some reason Curve sometimes says you can get >0 output tokens in exchange for 0 input

        uint256 balance0 = IERC20(outputToken).balanceOf(address(this));
        deal(inputToken, address(this), dx);
        IERC20(inputToken).approve(address(curveUsdcBold), dx);
        uint256 dy = curveUsdcBold.exchange(i, j, dx, 0);

        assertEqDecimal(IERC20(outputToken).balanceOf(address(this)) - balance0, dy, dyDecimals, "balance != dy");
        assertApproxEqRelDecimal(dy, dyExpected, 1e-5 ether, dyDecimals, "dy !~= expected dy");
    }

    function test_UniV3_CanQuoteApproxDx(bool collToUsdc, uint256 collIndex, uint256 dyExpected) external {
        collIndex = bound(collIndex, 0, branches.length - 1);
        address collToken = address(branches[collIndex].collToken);
        (address inputToken, address outputToken) = collToUsdc ? (collToken, USDC) : (USDC, collToken);
        uint256 dyDecimals = IERC20(outputToken).decimals();
        uint256 dyDiv = 10 ** (18 - dyDecimals);

        if (collToUsdc) {
            dyExpected = bound(dyExpected, 1 ether / dyDiv, 10_000 ether / dyDiv);
        } else {
            dyExpected = bound(dyExpected, 0.001 ether / dyDiv, 10 ether / dyDiv);
        }

        bytes[] memory pathUsdcToColl = new bytes[](collToken == WETH ? 3 : 5);
        pathUsdcToColl[0] = abi.encodePacked(USDC);
        pathUsdcToColl[1] = abi.encodePacked(UNIV3_FEE_USDC_WETH);
        pathUsdcToColl[2] = abi.encodePacked(WETH);
        if (collToken != WETH) {
            pathUsdcToColl[3] = abi.encodePacked(UNIV3_FEE_WETH_COLL);
            pathUsdcToColl[4] = abi.encodePacked(collToken);
        }

        bytes[] memory pathCollToUsdc = pathUsdcToColl.clone().reverse();
        (bytes memory swapPath, bytes memory quotePath) =
            collToUsdc ? (pathCollToUsdc.join(), pathUsdcToColl.join()) : (pathUsdcToColl.join(), pathCollToUsdc.join());

        uint256 dx = uniV3Quoter_quoteExactOutput(quotePath, dyExpected);
        uint256 balance0 = IERC20(outputToken).balanceOf(address(this));
        deal(inputToken, address(this), dx);
        IERC20(inputToken).approve(address(uniV3Router), dx);

        uint256 dy = uniV3Router.exactInput(
            ISwapRouter.ExactInputParams({
                path: swapPath,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: dx,
                amountOutMinimum: 0
            })
        );

        assertEqDecimal(IERC20(outputToken).balanceOf(address(this)) - balance0, dy, dyDecimals, "balance != dy");
        assertApproxEqAbsDecimal(dy, dyExpected, 4e-10 ether / dyDiv, dyDecimals, "dy !~= expected dy");
    }

    function test_ExchangeHelpersV2_CanQuoteApproxDx(bool collToBold, uint256 collIndex, uint256 dyExpected) external {
        collIndex = bound(collIndex, 0, branches.length - 1);
        address collToken = address(branches[collIndex].collToken);
        (address inputToken, address outputToken) = collToBold ? (collToken, BOLD) : (BOLD, collToken);

        if (collToBold) {
            dyExpected = bound(dyExpected, 1 ether, 10_000 ether);
        } else {
            dyExpected = bound(dyExpected, 0.001 ether, 10 ether);
        }

        uint256 dx = exchangeHelpersV2_quoteExactOutput(dyExpected, collToBold, collToken);
        uint256 balance0 = IERC20(outputToken).balanceOf(address(this));
        deal(inputToken, address(this), dx);
        IERC20(inputToken).approve(address(exchange[collToken]), dx);

        if (collToBold) {
            exchange[collToken].swapToBold(dx, 0);
        } else {
            exchange[collToken].swapFromBold(dx, 0);
        }

        uint256 dy = IERC20(outputToken).balanceOf(address(this)) - balance0;
        assertApproxEqRelDecimal(dy, dyExpected, 1e-5 ether, 18, "dy !~= expected dy");
    }

    function test_ExchangeHelpersV2_CanQuoteExactDy(bool collToBold, uint256 collIndex, uint256 dx) external {
        collIndex = bound(collIndex, 0, branches.length - 1);
        address collToken = address(branches[collIndex].collToken);
        (address inputToken, address outputToken) = collToBold ? (collToken, BOLD) : (BOLD, collToken);

        if (collToBold) {
            dx = bound(dx, 0.001 ether, 10 ether);
        } else {
            dx = bound(dx, 1 ether, 10_000 ether);
        }

        uint256 dyExpected = exchangeHelpersV2_quoteExactInput(dx, collToBold, collToken);
        uint256 balance0 = IERC20(outputToken).balanceOf(address(this));
        deal(inputToken, address(this), dx);
        IERC20(inputToken).approve(address(exchange[collToken]), dx);

        if (collToBold) {
            exchange[collToken].swapToBold(dx, 0);
        } else {
            exchange[collToken].swapFromBold(dx, 0);
        }

        uint256 dy = IERC20(outputToken).balanceOf(address(this)) - balance0;
        assertEqDecimal(dy, dyExpected, 18, "dy != expected dy");
    }

    function _revert(bytes memory revertData) private pure {
        assembly {
            revert(add(32, revertData), mload(revertData))
        }
    }

    function _decodeQuoteResult(bytes memory revertData) private pure returns (uint256) {
        bytes4 selector = bytes4(revertData);
        if (selector == QuoteResult.selector && revertData.length == 4 + 32) {
            return uint256(bytes32(revertData.slice(4)));
        } else {
            _revert(revertData); // bubble
        }
    }

    function uniV3Quoter_quoteExactOutput_throw(bytes memory path, uint256 amountOut) external {
        (uint256 amountIn,,,) = uniV3Quoter.quoteExactOutput(path, amountOut);
        revert QuoteResult(amountIn);
    }

    function uniV3Quoter_quoteExactOutput(bytes memory path, uint256 amountOut) internal returns (uint256) {
        try this.uniV3Quoter_quoteExactOutput_throw(path, amountOut) {
            revert("Should have reverted");
        } catch (bytes memory revertData) {
            return _decodeQuoteResult(revertData);
        }
    }

    function exchangeHelpersV2_quoteExactOutput_throw(uint256 dy, bool collToBold, address collToken) external {
        revert QuoteResult(exchangeHelpersV2.quoteExactOutput(dy, collToBold, collToken));
    }

    function exchangeHelpersV2_quoteExactOutput(uint256 dy, bool collToBold, address collToken)
        internal
        returns (uint256)
    {
        try this.exchangeHelpersV2_quoteExactOutput_throw(dy, collToBold, collToken) {
            revert("Should have reverted");
        } catch (bytes memory revertData) {
            return _decodeQuoteResult(revertData);
        }
    }

    function exchangeHelpersV2_quoteExactInput_throw(uint256 dx, bool collToBold, address collToken) external {
        revert QuoteResult(exchangeHelpersV2.quoteExactInput(dx, collToBold, collToken));
    }

    function exchangeHelpersV2_quoteExactInput(uint256 dx, bool collToBold, address collToken)
        internal
        returns (uint256)
    {
        try this.exchangeHelpersV2_quoteExactInput_throw(dx, collToBold, collToken) {
            revert("Should have reverted");
        } catch (bytes memory revertData) {
            return _decodeQuoteResult(revertData);
        }
    }

    // function assertApproxEqAbsRelDecimal(
    //     uint256 a,
    //     uint256 b,
    //     uint256 maxAbs,
    //     uint256 maxRel,
    //     uint256 decimals,
    //     string memory err
    // ) internal pure {
    //     uint256 abs = stdMath.delta(a, b);
    //     uint256 rel = stdMath.percentDelta(a, b);

    //     if (abs > maxAbs && rel > maxRel) {
    //         if (rel > maxRel) {
    //             assertApproxEqRelDecimal(a, b, maxRel, decimals, err);
    //         } else {
    //             assertApproxEqAbsDecimal(a, b, maxAbs, decimals, err);
    //         }

    //         revert("Assertion should have failed");
    //     }
    // }
}
