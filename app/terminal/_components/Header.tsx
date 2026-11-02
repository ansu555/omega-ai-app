"use client";

import Image from "next/image";
import Link from "next/link";
import { WalletConnect } from "@/components/features/wallet";
import { APP_NAV_ITEMS } from "@/components/layout/nav-items";
import { NavBar } from "@/components/ui/nav-bar";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/5 py-1 pl-1.5 pr-3 shadow-lg backdrop-blur-lg"
      >
        <Image
          src="/logo.png"
          alt="Omega"
          width={28}
          height={28}
          className="flex-shrink-0 rounded-full"
          priority
        />
        <span className="text-sm font-semibold text-foreground tracking-tight">Omega</span>
      </Link>
      <div className="hidden min-w-0 flex-1 justify-center overflow-hidden md:flex">
        <NavBar items={APP_NAV_ITEMS} />
      </div>
      <div className="ml-auto shrink-0">
        <WalletConnect />
      </div>
    </header>
  );
}
