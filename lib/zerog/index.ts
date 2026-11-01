/**
 * 0G Protocol — unified re-export barrel
 *
 * Import 0G SDK functionality from this single entry point:
 *
 *   import { uploadToStorage, saveAgentMemory } from '@/lib/zerog'
 *   import { computeInference, agentReason }    from '@/lib/zerog'
 *   import { submitToDA, postSwarmMessage }     from '@/lib/zerog'
 *
 * Each module is documented independently:
 *   - storage.ts  → 0G Storage (KV blobs + Log blobs for persistent memory)
 *   - compute.ts  → 0G Compute (decentralized AI inference, qwen3/GLM-5)
 *   - da.ts       → 0G DA (high-throughput data availability commitments)
 *
 * 0G service endpoints (Storage/Compute/DA) live in:
 *   lib/zerog/config.ts
 * They are independent of the app's trading chain (the chain registry).
 */

export * from './storage'
export * from './compute'
export * from './da'
export * from './private-strategy'

export {
  ZEROG_STORAGE_RPC,
  ZEROG_COMPUTE_ENDPOINT,
  ZEROG_DA_RPC,
  ZEROG_RPC,
  ZEROG_CHAIN_ID,
} from './config'
