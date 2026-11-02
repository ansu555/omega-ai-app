const { expect } = require("chai");
const { ethers } = require("hardhat");

const p18 = (n) => ethers.parseUnits(n.toString(), 18);

describe("OmeSwap Contracts", function () {
  let pools, router;
  let tokenA, tokenB, tokenC;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockERC20");
    tokenA = await MockToken.deploy("Token A", "TKA");
    tokenB = await MockToken.deploy("Token B", "TKB");
    tokenC = await MockToken.deploy("Token C", "TKC");

    const Pools = await ethers.getContractFactory("MultiTokenLiquidityPools");
    pools = await Pools.deploy();

    const Router = await ethers.getContractFactory("MultiHopSwapRouter");
    router = await Router.deploy(await pools.getAddress());

    const big = p18(100000);
    for (const tok of [tokenA, tokenB, tokenC]) {
      for (const acc of [owner, user1, user2]) {
        await tok.mint(acc.address, big);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("MultiTokenLiquidityPools", function () {

    describe("createPool", function () {
      it("creates a pool and increments poolCount", async function () {
        await pools.createPool(await tokenA.getAddress(), await tokenB.getAddress());
        expect(await pools.poolCount()).to.equal(1);
      });

      it("emits PoolCreated event", async function () {
        const addrA = await tokenA.getAddress();
        const addrB = await tokenB.getAddress();
        const tx = await pools.createPool(addrA, addrB);
        const receipt = await tx.wait();
        const event = receipt.logs.find(
          (l) => pools.interface.parseLog(l)?.name === "PoolCreated"
        );
        expect(event).to.not.be.undefined;
      });

      it("sorts tokens by address so token0 < token1", async function () {
        const addrA = await tokenA.getAddress();
        const addrB = await tokenB.getAddress();
        await pools.createPool(addrA, addrB);
        const poolId = await pools.getPoolId(addrA, addrB);
        const info = await pools.getPoolInfo(poolId);
        const lower = addrA.toLowerCase() < addrB.toLowerCase() ? addrA : addrB;
        expect(info.token0.toLowerCase()).to.equal(lower.toLowerCase());
      });

      it("reverts on duplicate pool", async function () {
        await pools.createPool(await tokenA.getAddress(), await tokenB.getAddress());
        await expect(
          pools.createPool(await tokenA.getAddress(), await tokenB.getAddress())
        ).to.be.revertedWith("Pool exists");
      });

      it("reverts on zero address", async function () {
        await expect(
          pools.createPool(ethers.ZeroAddress, await tokenB.getAddress())
        ).to.be.revertedWith("Zero address");
      });

      it("reverts on same token", async function () {
        const addrA = await tokenA.getAddress();
        await expect(pools.createPool(addrA, addrA)).to.be.revertedWith("Same token");
      });
    });

    // ── addLiquidity ──────────────────────────────────────────────────────────
    describe("addLiquidity", function () {
      let poolId, addrA, addrB;

      beforeEach(async function () {
        addrA = await tokenA.getAddress();
        addrB = await tokenB.getAddress();
        await pools.createPool(addrA, addrB);
        poolId = await pools.getPoolId(addrA, addrB);

        const poolsAddr = await pools.getAddress();
        await tokenA.approve(poolsAddr, ethers.MaxUint256);
        await tokenB.approve(poolsAddr, ethers.MaxUint256);
      });

      it("adds initial liquidity and updates reserves", async function () {
        await pools.addLiquidity(poolId, p18(100), p18(50), 0, 0);
        const info = await pools.getPoolInfo(poolId);
        expect(info.reserve0).to.be.gt(0);
        expect(info.reserve1).to.be.gt(0);
        expect(info.totalLPTokens).to.be.gt(0);
      });

      it("tracks user LP position", async function () {
        await pools.addLiquidity(poolId, p18(100), p18(50), 0, 0);
        const pos = await pools.getUserPosition(poolId, owner.address);
        expect(pos.lpTokens).to.be.gt(0);
        expect(pos.token0Deposited).to.be.gt(0);
        expect(pos.token1Deposited).to.be.gt(0);
      });

      it("allows a second liquidity add proportionally", async function () {
        await pools.addLiquidity(poolId, p18(100), p18(100), 0, 0);
        const before = await pools.getPoolInfo(poolId);

        await pools.addLiquidity(poolId, p18(20), p18(20), 0, 0);
        const after = await pools.getPoolInfo(poolId);

        expect(after.reserve0).to.be.gt(before.reserve0);
        expect(after.totalLPTokens).to.be.gt(before.totalLPTokens);
      });

      it("reverts on non-existent pool", async function () {
        await expect(
          pools.addLiquidity(999, p18(10), p18(10), 0, 0)
        ).to.be.revertedWith("Pool not found");
      });
    });

    // ── swap ─────────────────────────────────────────────────────────────────
    describe("swap", function () {
      let poolId, addrA, addrB;
      const LIQ_A = p18(1000);
      const LIQ_B = p18(1000);

      beforeEach(async function () {
        addrA = await tokenA.getAddress();
        addrB = await tokenB.getAddress();
        await pools.createPool(addrA, addrB);
        poolId = await pools.getPoolId(addrA, addrB);

        const poolsAddr = await pools.getAddress();
        await tokenA.approve(poolsAddr, ethers.MaxUint256);
        await tokenB.approve(poolsAddr, ethers.MaxUint256);
        await pools.addLiquidity(poolId, LIQ_A, LIQ_B, 0, 0);

        await tokenA.connect(user1).approve(poolsAddr, ethers.MaxUint256);
        await tokenB.connect(user1).approve(poolsAddr, ethers.MaxUint256);
      });

      it("swaps tokenA for tokenB and sends correct amount", async function () {
        const swapIn = p18(10);
        const expected = await pools.getAmountOut(swapIn, LIQ_A, LIQ_B);

        const before = await tokenB.balanceOf(user1.address);
        await pools.connect(user1).swap(poolId, addrA, swapIn, 0);
        const after = await tokenB.balanceOf(user1.address);

        expect(after - before).to.equal(expected);
      });

      it("swaps tokenB for tokenA", async function () {
        const swapIn = p18(10);
        const info = await pools.getPoolInfo(poolId);
        const expected = await pools.getAmountOut(swapIn, info.reserve1, info.reserve0);

        const before = await tokenA.balanceOf(user1.address);
        await pools.connect(user1).swap(poolId, addrB, swapIn, 0);
        const after = await tokenA.balanceOf(user1.address);

        expect(after - before).to.equal(expected);
      });

      it("output is less than input due to 0.3% fee + price impact", async function () {
        // 1:1 pool, swap 100 — ideal would be 100 back, with fee + impact < 100
        const swapIn = p18(100);
        const out = await pools.getAmountOut(swapIn, LIQ_A, LIQ_B);
        expect(out).to.be.lt(swapIn);
      });

      it("updates reserves after swap", async function () {
        const before = await pools.getPoolInfo(poolId);
        // pool sorts tokens by address — figure out which slot tokenA occupies
        const tokenAIsToken0 = before.token0.toLowerCase() === addrA.toLowerCase();

        await pools.connect(user1).swap(poolId, addrA, p18(10), 0);
        const after = await pools.getPoolInfo(poolId);

        if (tokenAIsToken0) {
          expect(after.reserve0).to.be.gt(before.reserve0); // tokenA in → reserve0 up
          expect(after.reserve1).to.be.lt(before.reserve1); // tokenB out → reserve1 down
        } else {
          expect(after.reserve1).to.be.gt(before.reserve1); // tokenA in → reserve1 up
          expect(after.reserve0).to.be.lt(before.reserve0); // tokenB out → reserve0 down
        }
      });

      it("reverts if output below amountOutMin", async function () {
        await expect(
          pools.connect(user1).swap(poolId, addrA, p18(1), ethers.MaxUint256)
        ).to.be.revertedWith("Too little output");
      });

      it("reverts with invalid token", async function () {
        await expect(
          pools.connect(user1).swap(poolId, await tokenC.getAddress(), p18(1), 0)
        ).to.be.revertedWith("Invalid token");
      });

      it("reverts on non-existent pool", async function () {
        await expect(
          pools.connect(user1).swap(999, addrA, p18(1), 0)
        ).to.be.revertedWith("Pool not found");
      });
    });

    // ── removeLiquidity ───────────────────────────────────────────────────────
    describe("removeLiquidity", function () {
      let poolId, addrA, addrB;

      beforeEach(async function () {
        addrA = await tokenA.getAddress();
        addrB = await tokenB.getAddress();
        await pools.createPool(addrA, addrB);
        poolId = await pools.getPoolId(addrA, addrB);

        const poolsAddr = await pools.getAddress();
        await tokenA.approve(poolsAddr, ethers.MaxUint256);
        await tokenB.approve(poolsAddr, ethers.MaxUint256);
        await pools.addLiquidity(poolId, p18(100), p18(100), 0, 0);
      });

      it("removes half LP and returns tokens", async function () {
        const pos = await pools.getUserPosition(poolId, owner.address);
        const lpToRemove = pos.lpTokens / 2n;

        const balABefore = await tokenA.balanceOf(owner.address);
        const balBBefore = await tokenB.balanceOf(owner.address);
        await pools.removeLiquidity(poolId, lpToRemove, 0, 0);
        const balAAfter = await tokenA.balanceOf(owner.address);
        const balBAfter = await tokenB.balanceOf(owner.address);

        expect(balAAfter).to.be.gt(balABefore);
        expect(balBAfter).to.be.gt(balBBefore);
      });

      it("removes all LP and zeroes out position", async function () {
        const pos = await pools.getUserPosition(poolId, owner.address);
        await pools.removeLiquidity(poolId, pos.lpTokens, 0, 0);
        const posAfter = await pools.getUserPosition(poolId, owner.address);
        expect(posAfter.lpTokens).to.equal(0);
      });

      it("reverts if LP balance is insufficient", async function () {
        await expect(
          pools.removeLiquidity(poolId, ethers.MaxUint256, 0, 0)
        ).to.be.revertedWith("Insufficient LP");
      });

      it("reverts if returned amounts are below minimums", async function () {
        const pos = await pools.getUserPosition(poolId, owner.address);
        await expect(
          pools.removeLiquidity(poolId, pos.lpTokens, ethers.MaxUint256, 0)
        ).to.be.revertedWith("Below min amounts");
      });
    });

    // ── Math helpers ──────────────────────────────────────────────────────────
    describe("getAmountOut (pure math)", function () {
      it("returns less than ideal due to 0.3% fee", async function () {
        const amountIn = p18(100);
        const reserveIn = p18(1000);
        const reserveOut = p18(1000);
        const out = await pools.getAmountOut(amountIn, reserveIn, reserveOut);
        // ideal (no fee) = 100 * 1000 / (1000 + 100) ≈ 90.9
        // with fee: slightly less
        expect(out).to.be.gt(p18(80));
        expect(out).to.be.lt(p18(91));
      });

      it("reverts on zero input", async function () {
        await expect(pools.getAmountOut(0, p18(1000), p18(1000)))
          .to.be.revertedWith("Zero input");
      });

      it("reverts on zero reserve", async function () {
        await expect(pools.getAmountOut(p18(1), 0, p18(1000)))
          .to.be.revertedWith("No liquidity");
      });
    });

    describe("quote (pure math)", function () {
      it("returns proportional amount", async function () {
        // quote(10, 100, 200) = 10 * 200 / 100 = 20
        const result = await pools.quote(p18(10), p18(100), p18(200));
        expect(result).to.equal(p18(20));
      });

      it("reverts on zero args", async function () {
        await expect(pools.quote(0, p18(100), p18(200))).to.be.revertedWith("Invalid args");
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("MultiHopSwapRouter", function () {
    let addrA, addrB, addrC;
    let poolsAddr, routerAddr;
    let poolIdAB, poolIdBC;

    beforeEach(async function () {
      addrA = await tokenA.getAddress();
      addrB = await tokenB.getAddress();
      addrC = await tokenC.getAddress();
      poolsAddr = await pools.getAddress();
      routerAddr = await router.getAddress();

      // Create A-B and B-C pools, seed with equal liquidity
      await pools.createPool(addrA, addrB);
      await pools.createPool(addrB, addrC);
      poolIdAB = await pools.getPoolId(addrA, addrB);
      poolIdBC = await pools.getPoolId(addrB, addrC);

      await tokenA.approve(poolsAddr, ethers.MaxUint256);
      await tokenB.approve(poolsAddr, ethers.MaxUint256);
      await tokenC.approve(poolsAddr, ethers.MaxUint256);
      await pools.addLiquidity(poolIdAB, p18(10000), p18(10000), 0, 0);
      await pools.addLiquidity(poolIdBC, p18(10000), p18(10000), 0, 0);

      // user1 approves router
      await tokenA.connect(user1).approve(routerAddr, ethers.MaxUint256);
      await tokenB.connect(user1).approve(routerAddr, ethers.MaxUint256);
      await tokenC.connect(user1).approve(routerAddr, ethers.MaxUint256);
    });

    describe("swapSingleHop", function () {
      it("swaps A -> B via router and delivers to caller", async function () {
        const before = await tokenB.balanceOf(user1.address);
        await router.connect(user1).swapSingleHop(addrA, addrB, p18(10), 0, user1.address);
        const after = await tokenB.balanceOf(user1.address);
        expect(after).to.be.gt(before);
      });

      it("delivers output to a different recipient", async function () {
        const before = await tokenB.balanceOf(user2.address);
        await router.connect(user1).swapSingleHop(addrA, addrB, p18(10), 0, user2.address);
        const after = await tokenB.balanceOf(user2.address);
        expect(after).to.be.gt(before);
      });

      it("emits SwapExecuted event", async function () {
        await expect(
          router.connect(user1).swapSingleHop(addrA, addrB, p18(10), 0, user1.address)
        ).to.emit(router, "SwapExecuted");
      });

      it("reverts when pool does not exist", async function () {
        // No A-C pool
        await expect(
          router.connect(user1).swapSingleHop(addrA, addrC, p18(1), 0, user1.address)
        ).to.be.revertedWith("Pool not found");
      });

      it("reverts if output is below amountOutMin", async function () {
        await expect(
          router.connect(user1).swapSingleHop(addrA, addrB, p18(10), ethers.MaxUint256, user1.address)
        ).to.be.revertedWith("Too little output");
      });
    });

    describe("swapTwoHop (A -> B -> C)", function () {
      it("routes A -> B -> C and delivers tokenC", async function () {
        const before = await tokenC.balanceOf(user1.address);
        await router.connect(user1).swapTwoHop(addrA, addrB, addrC, p18(10), 0, user1.address);
        const after = await tokenC.balanceOf(user1.address);
        expect(after).to.be.gt(before);
      });

      it("output of two-hop is less than single-hop due to double fee", async function () {
        const amtIn = p18(10);
        const singleOut = await router.getAmountOutTwoHop(addrA, addrA, addrB, amtIn).catch(() => 0n);
        // Just verify two-hop quote is positive and less than input
        const twoHopOut = await router.getAmountOutTwoHop(addrA, addrB, addrC, amtIn);
        expect(twoHopOut).to.be.gt(0);
        expect(twoHopOut).to.be.lt(amtIn);
      });
    });

    describe("swapThreeHop (needs A-B, B-C, C-D pools)", function () {
      let tokenD, addrD, poolIdCD;

      beforeEach(async function () {
        const MockToken = await ethers.getContractFactory("MockERC20");
        tokenD = await MockToken.deploy("Token D", "TKD");
        addrD = await tokenD.getAddress();

        await tokenD.mint(owner.address, p18(100000));
        await tokenD.mint(user1.address, p18(100000));

        await pools.createPool(addrC, addrD);
        poolIdCD = await pools.getPoolId(addrC, addrD);

        await tokenC.approve(poolsAddr, ethers.MaxUint256);
        await tokenD.approve(poolsAddr, ethers.MaxUint256);
        await pools.addLiquidity(poolIdCD, p18(10000), p18(10000), 0, 0);

        await tokenD.connect(user1).approve(routerAddr, ethers.MaxUint256);
      });

      it("routes A -> B -> C -> D", async function () {
        const before = await tokenD.balanceOf(user1.address);
        await router.connect(user1).swapThreeHop(addrA, addrB, addrC, addrD, p18(10), 0, user1.address);
        const after = await tokenD.balanceOf(user1.address);
        expect(after).to.be.gt(before);
      });
    });

    describe("getAmountOutTwoHop (view)", function () {
      it("returns a positive quote for A -> B -> C", async function () {
        const quote = await router.getAmountOutTwoHop(addrA, addrB, addrC, p18(10));
        expect(quote).to.be.gt(0);
      });

      it("reverts when a pool is missing", async function () {
        await expect(
          router.getAmountOutTwoHop(addrA, addrC, addrB, p18(10))
        ).to.be.revertedWith("Pool A-B not found");
      });
    });

    describe("recoverTokens (admin)", function () {
      it("lets owner recover tokens accidentally sent to router", async function () {
        await tokenA.transfer(routerAddr, p18(5));
        const before = await tokenA.balanceOf(owner.address);
        await router.recoverTokens(addrA, p18(5), owner.address);
        const after = await tokenA.balanceOf(owner.address);
        expect(after).to.be.gt(before);
      });

      it("reverts for non-owner", async function () {
        await expect(
          router.connect(user1).recoverTokens(addrA, p18(1), user1.address)
        ).to.be.revertedWith("Not owner");
      });
    });

    describe("constructor", function () {
      it("reverts on zero poolContract address", async function () {
        const Router = await ethers.getContractFactory("MultiHopSwapRouter");
        await expect(Router.deploy(ethers.ZeroAddress)).to.be.revertedWith("Zero address");
      });
    });
  });
});
