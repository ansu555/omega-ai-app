require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      // Conservative target so bytecode runs on any EVM L2 regardless of
      // whether it has adopted Shanghai's PUSH0.
      evmVersion: "paris",
    },
  },
  networks: {
    hashkeyTestnet: {
      url: process.env.HASHKEY_RPC_TESTNET || "https://testnet.hsk.xyz",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 133,
      gasPrice: "auto",
    },
    hashkey: {
      url: process.env.HASHKEY_RPC || "https://mainnet.hsk.xyz",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 177,
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
