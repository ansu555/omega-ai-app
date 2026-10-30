"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { gsap } from "gsap";
import { WalletConnect } from "@/components/features/wallet";
import { NavBar } from "@/components/ui/nav-bar";
import { APP_NAV_ITEMS } from "@/components/layout/nav-items";

export const Header = () => {
  const logoRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Initial load animation
    const logo = logoRef.current;

    if (logo) {
      gsap.fromTo(
        logo,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" },
      );
    }
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="relative max-w-7xl mx-auto px-6 py-4">
        <nav className="flex items-center gap-4">
          {/* Logo */}
          <Link
            href="/"
            ref={logoRef}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <Logo />
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex flex-1 justify-center min-w-0 overflow-hidden">
            <NavBar items={APP_NAV_ITEMS} />
          </div>

          {/* Right Section - Connect Wallet */}
          <div className="hidden md:flex items-center shrink-0">
            <WalletConnect />
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden ml-auto flex flex-col gap-1.5 p-2">
            <span className="w-5 h-0.5 bg-white rounded-full" />
            <span className="w-5 h-0.5 bg-white rounded-full" />
          </button>
        </nav>
      </div>

      {/* Mobile Bottom NavBar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-6 md:hidden">
        <NavBar items={APP_NAV_ITEMS} />
      </div>
    </header>
  );
};
