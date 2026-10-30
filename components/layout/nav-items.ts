import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Coins,
  Compass,
  Cpu,
  Droplets,
  FlaskConical,
  Receipt,
  Store,
  Wallet,
  BookOpen,
} from "lucide-react";

export type AppNavChildItem = {
  name: string;
  url: string;
  icon: LucideIcon;
  badge?: string;
};

export type AppNavItem = {
  name: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
  children?: AppNavChildItem[];
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { name: "Explore", url: "/explore", icon: Compass },
  {
    name: "Trade",
    url: "/trade",
    icon: ArrowLeftRight,
    children: [
      { name: "Liquidity", url: "/liquidity", icon: Droplets },
      { name: "Mint Tokens", url: "/mint", icon: Coins, badge: "test" },
      { name: "Terminal", url: "/terminal", icon: FlaskConical },
    ],
  },
  { name: "Research", url: "/research", icon: BookOpen },
  { name: "Builder", url: "/agent-builder", icon: Cpu },
  { name: "Marketplace", url: "/marketplace", icon: Store },
  { name: "Transactions", url: "/transactions", icon: Receipt },
  { name: "Portfolio", url: "/portfolio", icon: Wallet },
];

export function findActiveNavItem(
  items: AppNavItem[],
  pathname: string,
): AppNavItem | null {
  for (const item of items) {
    if (item.url === pathname) return item;
    if (item.children?.some((child) => child.url === pathname)) return item;
  }
  return null;
}
