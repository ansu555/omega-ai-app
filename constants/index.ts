// Application constants

export const APP_NAME = 'Omega';

// Chain IDs live in the registry — see lib/chain-registry/index.ts (DEFAULT_CHAIN_ID)
// and lib/chain-registry/chains/ for per-chain configuration.

export const ROUTES = {
  HOME: '/',
  EXPLORE: '/explore',
  TRADE: '/trade',
  PORTFOLIO: '/portfolio',
  TOKENS: '/cryptocurrencies',
  TRANSACTIONS: '/transactions',
} as const;

export const EXTERNAL_LINKS = {
  DOCS: 'https://docs.0g.ai',
  GITHUB: 'https://github.com/0glabs',
  EXPLORER: 'https://hashkey.blockscout.com',
  STORAGE_DOCS: 'https://docs.0g.ai/0g-storage',
  COMPUTE_DOCS: 'https://docs.0g.ai/0g-compute',
  DA_DOCS: 'https://docs.0g.ai/0g-da',
} as const;
