"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import {
  ALL_TILE_IDS,
  DEFAULT_LAYOUT,
  TileId,
  TileLayoutItem,
  useTerminalStore,
} from "@/store/terminal";

const KEY_PREFIX = "omeswap.terminal.layout.v1.";
const ANON_KEY = `${KEY_PREFIX}anon`;

type Persisted = {
  layout: TileLayoutItem[];
  mountedTiles: TileId[];
};

function storageKey(address: string | undefined): string {
  return address ? `${KEY_PREFIX}${address.toLowerCase()}` : ANON_KEY;
}

function readLayout(address: string | undefined): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.layout) || !Array.isArray(parsed.mountedTiles)) {
      return null;
    }
    const validIds = new Set<TileId>(ALL_TILE_IDS);
    const layout = parsed.layout.filter((l) => validIds.has(l.i as TileId));
    const mountedTiles = parsed.mountedTiles.filter((id) => validIds.has(id));
    return { layout, mountedTiles };
  } catch {
    return null;
  }
}

function writeLayout(address: string | undefined, value: Persisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(value));
  } catch {
    // quota or serialization error — ignore
  }
}

export function useTerminalLayout(): void {
  const { address } = useAccount();
  const lastLoadedKey = useRef<string | null>(null);

  // Load when wallet identity changes.
  useEffect(() => {
    const key = storageKey(address);
    if (lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;

    const stored = readLayout(address);
    if (stored) {
      useTerminalStore.setState({
        layout: stored.layout,
        mountedTiles: new Set(stored.mountedTiles),
      });
    } else {
      useTerminalStore.setState({
        layout: DEFAULT_LAYOUT,
        mountedTiles: new Set(DEFAULT_LAYOUT.map((l) => l.i)),
      });
    }
  }, [address]);

  // Persist on every change.
  useEffect(() => {
    const unsub = useTerminalStore.subscribe((state, prev) => {
      if (state.layout === prev.layout && state.mountedTiles === prev.mountedTiles) {
        return;
      }
      writeLayout(address, {
        layout: state.layout,
        mountedTiles: Array.from(state.mountedTiles),
      });
    });
    return unsub;
  }, [address]);
}
