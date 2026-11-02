// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract MultiTokenLiquidityPools {
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant FEE_PERCENT = 30; // 0.3%

    struct Pool {
        address token0;
        address token1;
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalLPTokens;
        bool exists;
    }

    struct LPPosition {
        uint256 lpTokens;
        uint256 token0Deposited;
        uint256 token1Deposited;
    }

    address public owner;
    uint256 public poolCount;

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => LPPosition)) public lpPositions;
    mapping(address => mapping(address => uint256)) public pairToPoolId;

    event PoolCreated(uint256 indexed poolId, address token0, address token1);
    event LiquidityAdded(uint256 indexed poolId, address indexed provider, uint256 amount0, uint256 amount1, uint256 lpTokens);
    event LiquidityRemoved(uint256 indexed poolId, address indexed provider, uint256 amount0, uint256 amount1, uint256 lpTokens);
    event Swap(uint256 indexed poolId, address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createPool(address token0, address token1) external returns (uint256 poolId) {
        require(token0 != address(0) && token1 != address(0), "Zero address");
        require(token0 != token1, "Same token");

        if (token0 > token1) (token0, token1) = (token1, token0);

        require(pairToPoolId[token0][token1] == 0, "Pool exists");

        poolCount++;
        poolId = poolCount;

        pools[poolId] = Pool({
            token0: token0,
            token1: token1,
            reserve0: 0,
            reserve1: 0,
            totalLPTokens: 0,
            exists: true
        });

        pairToPoolId[token0][token1] = poolId;
        emit PoolCreated(poolId, token0, token1);
    }

    function addLiquidity(
        uint256 poolId,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint256 amount0, uint256 amount1, uint256 lpTokens) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool not found");

        if (pool.reserve0 == 0 && pool.reserve1 == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
        } else {
            uint256 amount1Optimal = quote(amount0Desired, pool.reserve0, pool.reserve1);
            if (amount1Optimal <= amount1Desired) {
                require(amount1Optimal >= amount1Min, "Slippage: token1");
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                uint256 amount0Optimal = quote(amount1Desired, pool.reserve1, pool.reserve0);
                require(amount0Optimal <= amount0Desired, "Optimal exceeds desired");
                require(amount0Optimal >= amount0Min, "Slippage: token0");
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }
        }

        require(amount0 >= amount0Min && amount1 >= amount1Min, "Below min amounts");

        require(IERC20(pool.token0).transferFrom(msg.sender, address(this), amount0), "Transfer0 failed");
        require(IERC20(pool.token1).transferFrom(msg.sender, address(this), amount1), "Transfer1 failed");

        if (pool.totalLPTokens == 0) {
            lpTokens = _sqrt(amount0 * amount1);
        } else {
            uint256 lp0 = (amount0 * pool.totalLPTokens) / pool.reserve0;
            uint256 lp1 = (amount1 * pool.totalLPTokens) / pool.reserve1;
            lpTokens = lp0 < lp1 ? lp0 : lp1;
        }
        require(lpTokens > 0, "Zero LP tokens");

        pool.reserve0 += amount0;
        pool.reserve1 += amount1;
        pool.totalLPTokens += lpTokens;

        LPPosition storage pos = lpPositions[poolId][msg.sender];
        pos.lpTokens += lpTokens;
        pos.token0Deposited += amount0;
        pos.token1Deposited += amount1;

        emit LiquidityAdded(poolId, msg.sender, amount0, amount1, lpTokens);
    }

    function removeLiquidity(
        uint256 poolId,
        uint256 lpTokens,
        uint256 amount0Min,
        uint256 amount1Min
    ) external returns (uint256 amount0, uint256 amount1) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool not found");

        LPPosition storage pos = lpPositions[poolId][msg.sender];
        require(pos.lpTokens >= lpTokens, "Insufficient LP");

        amount0 = (lpTokens * pool.reserve0) / pool.totalLPTokens;
        amount1 = (lpTokens * pool.reserve1) / pool.totalLPTokens;

        require(amount0 >= amount0Min && amount1 >= amount1Min, "Below min amounts");

        pool.reserve0 -= amount0;
        pool.reserve1 -= amount1;
        pool.totalLPTokens -= lpTokens;
        pos.lpTokens -= lpTokens;

        // Reduce deposited amounts proportionally
        if (pos.lpTokens == 0) {
            pos.token0Deposited = 0;
            pos.token1Deposited = 0;
        } else {
            uint256 removedShare = (lpTokens * 1e18) / (pos.lpTokens + lpTokens);
            pos.token0Deposited -= (pos.token0Deposited * removedShare) / 1e18;
            pos.token1Deposited -= (pos.token1Deposited * removedShare) / 1e18;
        }

        require(IERC20(pool.token0).transfer(msg.sender, amount0), "Transfer0 failed");
        require(IERC20(pool.token1).transfer(msg.sender, amount1), "Transfer1 failed");

        emit LiquidityRemoved(poolId, msg.sender, amount0, amount1, lpTokens);
    }

    function swap(
        uint256 poolId,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool not found");
        require(tokenIn == pool.token0 || tokenIn == pool.token1, "Invalid token");

        bool zeroForOne = tokenIn == pool.token0;
        uint256 reserveIn  = zeroForOne ? pool.reserve0 : pool.reserve1;
        uint256 reserveOut = zeroForOne ? pool.reserve1 : pool.reserve0;

        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "Too little output");

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TransferIn failed");

        address tokenOut = zeroForOne ? pool.token1 : pool.token0;
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "TransferOut failed");

        if (zeroForOne) {
            pool.reserve0 += amountIn;
            pool.reserve1 -= amountOut;
        } else {
            pool.reserve1 += amountIn;
            pool.reserve0 -= amountOut;
        }

        emit Swap(poolId, msg.sender, tokenIn, amountIn, amountOut);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Zero input");
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_PERCENT);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    }

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0 && reserveA > 0 && reserveB > 0, "Invalid args");
        amountB = (amountA * reserveB) / reserveA;
    }

    function getPoolId(address token0, address token1) external view returns (uint256) {
        if (token0 > token1) (token0, token1) = (token1, token0);
        return pairToPoolId[token0][token1];
    }

    function getPoolInfo(uint256 poolId) external view returns (
        address token0,
        address token1,
        uint256 reserve0,
        uint256 reserve1,
        uint256 totalLPTokens
    ) {
        Pool storage pool = pools[poolId];
        require(pool.exists, "Pool not found");
        return (pool.token0, pool.token1, pool.reserve0, pool.reserve1, pool.totalLPTokens);
    }

    function getUserPosition(uint256 poolId, address user) external view returns (
        uint256 lpTokens,
        uint256 token0Deposited,
        uint256 token1Deposited
    ) {
        LPPosition storage pos = lpPositions[poolId][user];
        return (pos.lpTokens, pos.token0Deposited, pos.token1Deposited);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) {
            z = 1;
        }
    }
}
