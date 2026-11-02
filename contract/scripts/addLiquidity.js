const hre = require("hardhat");
const { ethers } = hre;

// ── Update these after running deploy.js ─────────────────────────────────────
const POOLS_ADDRESS  = process.env.POOLS_ADDRESS  || "0x0000000000000000000000000000000000000000";
const W0G_ADDRESS    = "0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c";
const USDC_ADDRESS   = "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e";

// Amount to seed: 10 W0G + 5 USDC.e  (adjust to match current price ~$0.5/W0G)
const W0G_AMOUNT  = ethers.parseUnits("10", 18);   // 10 W0G
const USDC_AMOUNT = ethers.parseUnits("5", 6);     // 5 USDC.e

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const POOLS_ABI = [
  "function getPoolId(address, address) view returns (uint256)",
  "function addLiquidity(uint256, uint256, uint256, uint256, uint256) returns (uint256, uint256, uint256)",
  "function getPoolInfo(uint256) view returns (address, address, uint256, uint256, uint256)",
];

async function main() {
  if (POOLS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("Set POOLS_ADDRESS env var to the deployed pools contract address");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log("Adding liquidity from:", signer.address);

  const pools = new ethers.Contract(POOLS_ADDRESS, POOLS_ABI, signer);
  const w0g   = new ethers.Contract(W0G_ADDRESS,  ERC20_ABI, signer);
  const usdc  = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

  // Check balances
  const w0gBal  = await w0g.balanceOf(signer.address);
  const usdcBal = await usdc.balanceOf(signer.address);
  console.log("W0G balance: ", ethers.formatUnits(w0gBal, 18));
  console.log("USDC.e balance:", ethers.formatUnits(usdcBal, 6));

  if (w0gBal < W0G_AMOUNT) { console.error("Insufficient W0G"); process.exit(1); }
  if (usdcBal < USDC_AMOUNT) { console.error("Insufficient USDC.e"); process.exit(1); }

  // Get pool ID
  const poolId = await pools.getPoolId(W0G_ADDRESS, USDC_ADDRESS);
  console.log("Pool ID:", poolId.toString());

  // Approve
  console.log("Approving W0G...");
  await (await w0g.approve(POOLS_ADDRESS, W0G_AMOUNT)).wait();
  console.log("Approving USDC.e...");
  await (await usdc.approve(POOLS_ADDRESS, USDC_AMOUNT)).wait();

  // Add liquidity (0% slippage for initial seed)
  console.log("Adding liquidity...");
  const tx = await pools.addLiquidity(poolId, W0G_AMOUNT, USDC_AMOUNT, 0, 0);
  const receipt = await tx.wait();
  console.log("Tx:", receipt.hash);

  const info = await pools.getPoolInfo(poolId);
  console.log("\nPool reserves after:");
  console.log("  W0G: ", ethers.formatUnits(info[2] < info[3] ? info[2] : info[3], info[0].toLowerCase() === W0G_ADDRESS.toLowerCase() ? 18 : 6));
  console.log("  USDC.e:", ethers.formatUnits(info[2] < info[3] ? info[3] : info[2], 6));
}

main().catch((err) => { console.error(err); process.exit(1); });
