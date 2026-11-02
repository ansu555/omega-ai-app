const hre = require("hardhat");
const { ethers } = hre;

const POOLS_ADDRESS = process.env.POOLS_ADDRESS;

const POOLS_ABI = [
  "function createPool(address, address) returns (uint256)",
  "function getPoolId(address, address) view returns (uint256)",
  "function addLiquidity(uint256, uint256, uint256, uint256, uint256) returns (uint256, uint256, uint256)",
  "function getPoolInfo(uint256) view returns (address, address, uint256, uint256, uint256)",
];

const ERC20_ABI = [
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  if (!POOLS_ADDRESS || POOLS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("Set POOLS_ADDRESS env var (should already be in .env)");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log("Deploying from:", signer.address);

  const Token = await ethers.getContractFactory("OmeSwapToken");

  // OmE: 1 billion tokens, 18 decimals
  console.log("\n[1/5] Deploying OmE token...");
  const ome = await Token.deploy("OmE Token", "OmE", 18, ethers.parseUnits("1000000000", 18));
  await ome.waitForDeployment();
  const omeAddr = await ome.getAddress();
  console.log("OmE:", omeAddr);

  // USDO: 1 billion tokens, 6 decimals (stablecoin-like)
  console.log("\n[2/5] Deploying USDO token...");
  const usdo = await Token.deploy("OmeSwap USD", "USDO", 6, ethers.parseUnits("1000000000", 6));
  await usdo.waitForDeployment();
  const usdoAddr = await usdo.getAddress();
  console.log("USDO:", usdoAddr);

  // Create OmE/USDO pool in the already-deployed pools contract
  console.log("\n[3/5] Creating OmE/USDO pool...");
  const pools = new ethers.Contract(POOLS_ADDRESS, POOLS_ABI, signer);
  const createTx = await pools.createPool(omeAddr, usdoAddr);
  await createTx.wait();
  const poolId = await pools.getPoolId(omeAddr, usdoAddr);
  console.log("Pool ID:", poolId.toString());

  // Seed: 100,000 OmE + 50,000 USDO → OmE price = $0.50 USDO
  const OME_SEED  = ethers.parseUnits("100000", 18);
  const USDO_SEED = ethers.parseUnits("50000", 6);

  console.log("\n[4/5] Approving tokens...");
  const omeC  = new ethers.Contract(omeAddr,  ERC20_ABI, signer);
  const usdoC = new ethers.Contract(usdoAddr, ERC20_ABI, signer);
  await (await omeC.approve(POOLS_ADDRESS, OME_SEED)).wait();
  await (await usdoC.approve(POOLS_ADDRESS, USDO_SEED)).wait();

  console.log("\n[5/5] Adding liquidity (100,000 OmE + 50,000 USDO)...");
  const liqTx = await pools.addLiquidity(poolId, OME_SEED, USDO_SEED, 0, 0);
  const receipt = await liqTx.wait();
  console.log("Tx:", receipt.hash);

  const info = await pools.getPoolInfo(poolId);
  console.log("\nPool reserves:");
  console.log("  token0:", info[0]);
  console.log("  token1:", info[1]);

  console.log("\n" + "=".repeat(60));
  console.log("COPY THESE INTO the testnet branch of lib/chain-registry/chains/hashkey.ts:");
  console.log("=".repeat(60));
  console.log(`  OmE:  "${omeAddr}"`);
  console.log(`  USDO: "${usdoAddr}"`);
  console.log("=".repeat(60));
}

main().catch((err) => { console.error(err); process.exit(1); });
