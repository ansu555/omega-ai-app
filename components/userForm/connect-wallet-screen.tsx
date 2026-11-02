"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";

export function ConnectWalletScreen() {
  const { openConnectModal } = useConnectModal();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-10 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-primary" />
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            Omega Onboarding
          </p>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Connect wallet to continue
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Onboarding is saved once per wallet. Connect to check your profile.
          </p>

          <button
            onClick={openConnectModal}
            className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all duration-150"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
