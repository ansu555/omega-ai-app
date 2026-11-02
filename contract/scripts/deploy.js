const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MNT");

  // 1. Deploy Pools
  console.log("\n[1/2] Deploying MultiTokenLiquidityPools...");
  const Pools = await ethers.getContractFactory("MultiTokenLiquidityPools");
  const pools = await Pools.deploy();
  await pools.waitForDeployment();
  const poolsAddress = await pools.getAddress();
  console.log("MultiTokenLiquidityPools:", poolsAddress);

  // 2. Deploy Router
  console.log("\n[2/2] Deploying MultiHopSwapRouter...");
  const Router = await ethers.getContractFactory("MultiHopSwapRouter");
  const router = await Router.deploy(poolsAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("MultiHopSwapRouter:", routerAddress);

  console.log("\nDeployment complete!");
  console.log("=".repeat(60));
  console.log("COPY THESE INTO the testnet branch of lib/chain-registry/chains/hashkey.ts:");
  console.log("=".repeat(60));
  console.log(`  omeswapPools:  "${poolsAddress}"`);
  console.log(`  omeswapRouter: "${routerAddress}"`);
  console.log("=".repeat(60));
  console.log(`\nNext step: POOLS_ADDRESS=${poolsAddress} npx hardhat run scripts/deployTokens.js --network hashkeyTestnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
