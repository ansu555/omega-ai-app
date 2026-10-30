"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { normalizeWalletAddress } from "@/lib/onboarding";

export function OnboardingGuard() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Track the last address we already cleared — avoids re-checking on re-renders
  const checkedAddressRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (!isConnected || !address) return;

    const normalized = normalizeWalletAddress(address);

    // Same wallet we already checked this session — nothing to do
    if (checkedAddressRef.current === normalized) return;
    // Guard against concurrent checks (e.g. rapid re-renders)
    if (isCheckingRef.current) return;

    isCheckingRef.current = true;

    const checkAndRedirect = async () => {
      try {
        // Fast path: localStorage
        const stored = localStorage.getItem("onboarding_wallet");
        if (stored === normalized) {
          checkedAddressRef.current = normalized;
          return;
        }

        // Slow path: API
        const res = await fetch(
          `/api/onboarding?wallet=${encodeURIComponent(normalized)}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error("check failed");

        const data = (await res.json()) as { exists: boolean };
        checkedAddressRef.current = normalized;

        if (data.exists) {
          localStorage.setItem("onboarding_wallet", normalized);
        } else {
          localStorage.removeItem("onboarding_wallet");
          router.push("/onboarding");
        }
      } catch {
        // On network error, redirect to onboarding to be safe
        checkedAddressRef.current = normalized;
        router.push("/onboarding");
      } finally {
        isCheckingRef.current = false;
      }
    };

    void checkAndRedirect();
  }, [address, isConnected, router]);

  return null;
}
