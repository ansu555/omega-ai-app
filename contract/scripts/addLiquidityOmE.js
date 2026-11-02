// One-shot script to seed OmE/USDO pool (pool ID 2, already created).
// The pool sorts tokens by address, so we query token0/token1 before calling addLiquidity.

const hre = require("hardhat");
const { ethers } = hre;

const POOLS_ADDRESS = process.env.POOLS_ADDRESS;
const OME_ADDRESS   = "0x87E3FC6944FAe11FEfd71d61003f42C6d1b445BF";
const USDO_ADDRESS  = "0x4c95c850D6C89775791B801fDc7ED739702a8811";
const POOL_ID       = 2;

const POOLS_ABI = [
  "function addLiquidity(uint256,uint256,uint256,uint256,uint256) returns (uint256,uint256,uint256)",
  "function getPoolInfo(uint256) view returns (address,address,uint256,uint256,uint256)",
];

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  if (!POOLS_ADDRESS) { console.error("POOLS_ADDRESS not set in .env"); process.exit(1); }

  const [signer] = await ethers.getSigners();
  console.log("Seeding from:", signer.address);

  const pools = new ethers.Contract(POOLS_ADDRESS, POOLS_ABI, signer);
  const ome   = new ethers.Contract(OME_ADDRESS,   ERC20_ABI, signer);
  const usdo  = new ethers.Contract(USDO_ADDRESS,  ERC20_ABI, signer);

  // Determine which is token0 / token1 by querying the deployed pool
  const info   = await pools.getPoolInfo(POOL_ID);
  const token0 = info[0].toLowerCase();
  console.log("Pool token0:", info[0], " token1:", info[1]);

  const OME_SEED  = ethers.parseUnits("100000", 18);  // 100,000 OmE
  const USDO_SEED = ethers.parseUnits("50000",  6);   //  50,000 USDO → price $0.50/OmE

  // amount0 must match token0, amount1 must match token1
  const omeIsToken0 = token0 === OME_ADDRESS.toLowerCase();
  const amount0 = omeIsToken0 ? OME_SEED  : USDO_SEED;
  const amount1 = omeIsToken0 ? USDO_SEED : OME_SEED;

  console.log("\nApproving OmE...");
  await (await ome.approve(POOLS_ADDRESS, OME_SEED)).wait();

  console.log("Approving USDO...");
  await (await usdo.approve(POOLS_ADDRESS, USDO_SEED)).wait();

  console.log("Adding liquidity...");
  const tx = await pools.addLiquidity(POOL_ID, amount0, amount1, 0, 0);
  const receipt = await tx.wait();
  console.log("Done! Tx:", receipt.hash);

  const after = await pools.getPoolInfo(POOL_ID);
  console.log("\nPool reserves:");
  console.log("  token0 reserve:", ethers.formatUnits(after[2], omeIsToken0 ? 18 : 6));
  console.log("  token1 reserve:", ethers.formatUnits(after[3], omeIsToken0 ? 6  : 18));
}

main().catch((err) => { console.error(err); process.exit(1); });
