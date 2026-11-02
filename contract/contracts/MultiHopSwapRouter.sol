// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IMultiTokenLiquidityPools {
    function getPoolId(address token0, address token1) external view returns (uint256);
    function getPoolInfo(uint256 poolId) external view returns (
        address token0, address token1, uint256 reserve0, uint256 reserve1, uint256 totalLPTokens
    );
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256);
    function swap(uint256 poolId, address tokenIn, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut);
}

contract MultiHopSwapRouter {
    IMultiTokenLiquidityPools public poolContract;
    address public owner;

    event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _poolContract) {
        require(_poolContract != address(0), "Zero address");
        poolContract = IMultiTokenLiquidityPools(_poolContract);
        owner = msg.sender;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _getReserves(uint256 poolId, address tokenIn) internal view returns (uint256 reserveIn, uint256 reserveOut) {
        (address t0, , uint256 r0, uint256 r1,) = poolContract.getPoolInfo(poolId);
        (reserveIn, reserveOut) = tokenIn == t0 ? (r0, r1) : (r1, r0);
    }

    function _doSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) internal returns (uint256 amountOut) {
        uint256 poolId = poolContract.getPoolId(tokenIn, tokenOut);
        require(poolId != 0, "Pool not found");

        require(IERC20(tokenIn).approve(address(poolContract), amountIn), "Approve failed");
        amountOut = poolContract.swap(poolId, tokenIn, amountIn, amountOutMin);
    }

    // ── Public swap functions ─────────────────────────────────────────────────

    function swapSingleHop(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external returns (uint256 amountOut) {
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TransferIn failed");
        amountOut = _doSwap(tokenIn, tokenOut, amountIn, amountOutMin);
        require(IERC20(tokenOut).transfer(recipient, amountOut), "TransferOut failed");
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function swapTwoHop(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external returns (uint256 amountOut) {
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountIn), "TransferIn failed");

        uint256 amountB = _doSwap(tokenA, tokenB, amountIn, 0);
        amountOut = _doSwap(tokenB, tokenC, amountB, amountOutMin);

        require(IERC20(tokenC).transfer(recipient, amountOut), "TransferOut failed");
        emit SwapExecuted(msg.sender, tokenA, tokenC, amountIn, amountOut);
    }

    function swapThreeHop(
        address tokenA,
        address tokenB,
        address tokenC,
        address tokenD,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external returns (uint256 amountOut) {
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountIn), "TransferIn failed");

        uint256 amountB = _doSwap(tokenA, tokenB, amountIn, 0);
        uint256 amountC = _doSwap(tokenB, tokenC, amountB, 0);
        amountOut = _doSwap(tokenC, tokenD, amountC, amountOutMin);

        require(IERC20(tokenD).transfer(recipient, amountOut), "TransferOut failed");
        emit SwapExecuted(msg.sender, tokenA, tokenD, amountIn, amountOut);
    }

    // ── Quote functions (read-only) ───────────────────────────────────────────

    function getAmountOutTwoHop(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        uint256 poolAB = poolContract.getPoolId(tokenA, tokenB);
        require(poolAB != 0, "Pool A-B not found");
        (uint256 rInAB, uint256 rOutAB) = _getReserves(poolAB, tokenA);
        uint256 amountB = poolContract.getAmountOut(amountIn, rInAB, rOutAB);

        uint256 poolBC = poolContract.getPoolId(tokenB, tokenC);
        require(poolBC != 0, "Pool B-C not found");
        (uint256 rInBC, uint256 rOutBC) = _getReserves(poolBC, tokenB);
        amountOut = poolContract.getAmountOut(amountB, rInBC, rOutBC);
    }

    function getAmountOutThreeHop(
        address tokenA,
        address tokenB,
        address tokenC,
        address tokenD,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        uint256 poolAB = poolContract.getPoolId(tokenA, tokenB);
        require(poolAB != 0, "Pool A-B not found");
        (uint256 rInAB, uint256 rOutAB) = _getReserves(poolAB, tokenA);
        uint256 amountB = poolContract.getAmountOut(amountIn, rInAB, rOutAB);

        uint256 poolBC = poolContract.getPoolId(tokenB, tokenC);
        require(poolBC != 0, "Pool B-C not found");
        (uint256 rInBC, uint256 rOutBC) = _getReserves(poolBC, tokenB);
        uint256 amountC = poolContract.getAmountOut(amountB, rInBC, rOutBC);

        uint256 poolCD = poolContract.getPoolId(tokenC, tokenD);
        require(poolCD != 0, "Pool C-D not found");
        (uint256 rInCD, uint256 rOutCD) = _getReserves(poolCD, tokenC);
        amountOut = poolContract.getAmountOut(amountC, rInCD, rOutCD);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function recoverTokens(address token, uint256 amount, address to) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "Transfer failed");
    }
}
