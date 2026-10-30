import type { NextConfig } from "next";

// Node.js v25+ ships a built-in `localStorage` global backed by no file
// (--localstorage-file is not set). The object exists but none of its
// methods are functions. @walletconnect/keyvaluestorage captures
// `globalThis.localStorage` in a module-level IIFE, so any polyfill must
// run BEFORE webpack evaluates that module. Injecting via BannerPlugin
// guarantees the shim is the very first code in every server-side bundle.
const localStorageShim = `
if (typeof globalThis !== 'undefined' &&
    (typeof globalThis.localStorage === 'undefined' ||
     typeof globalThis.localStorage.getItem !== 'function')) {
  globalThis.localStorage = {
    getItem: function() { return null; },
    setItem: function() {},
    removeItem: function() {},
    clear: function() {},
    key: function() { return null; },
    length: 0,
  };
}`;

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'coin-images.coingecko.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's2.coinmarketcap.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'imgproxy-mainnet.routescan.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static-assets.coinbase.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cryptologos.cc',
        pathname: '/**',
      },
    ],
  },
  webpack: (cfg, { isServer, webpack }) => {
    cfg.resolve.fallback = {
      ...(cfg.resolve.fallback || {}),
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };

    if (isServer) {
      cfg.plugins = [
        ...(cfg.plugins || []),
        new webpack.BannerPlugin({ banner: localStorageShim, raw: true }),
      ];
    }

    return cfg;
  },
};

export default config;
