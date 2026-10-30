"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  findActiveNavItem,
  type AppNavChildItem,
  type AppNavItem,
} from "@/components/layout/nav-items";

interface NavBarProps {
  items: AppNavItem[];
  className?: string;
}

function NavLamp() {
  return (
    <motion.div
      layoutId="lamp"
      className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
      initial={false}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
        <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
        <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
        <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
      </div>
    </motion.div>
  );
}

function NavDropdown({
  item,
  isActive,
  onSelect,
}: {
  item: AppNavItem;
  isActive: boolean;
  onSelect: (name: string) => void;
}) {
  const Icon = item.icon;
  const children = item.children ?? [];

  return (
    <DropdownMenu>
      <div
        className={cn(
          "relative flex items-center rounded-full transition-colors",
          isActive && "bg-muted text-primary",
        )}
      >
        <Link
          href={item.url}
          onClick={() => onSelect(item.name)}
          className={cn(
            "cursor-pointer text-xs font-semibold pl-3.5 pr-1.5 py-2 rounded-l-full transition-colors whitespace-nowrap",
            "text-foreground/80 hover:text-primary",
            isActive && "text-primary",
          )}
        >
          <span className="hidden md:inline">{item.name}</span>
          <span className="md:hidden">
            <Icon size={18} strokeWidth={2.5} />
          </span>
        </Link>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${item.name} menu`}
            className={cn(
              "flex items-center justify-center rounded-r-full py-2 pr-2.5 pl-0.5 transition-colors",
              "text-foreground/80 hover:text-primary",
              isActive && "text-primary",
            )}
          >
            <ChevronDown size={14} strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        {isActive && <NavLamp />}
      </div>
      <DropdownMenuContent align="center" className="min-w-[10rem]">
        {children.map((child) => (
          <NavDropdownLink
            key={child.url}
            child={child}
            onSelect={() => onSelect(item.name)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavDropdownLink({
  child,
  onSelect,
}: {
  child: AppNavChildItem;
  onSelect: () => void;
}) {
  const ChildIcon = child.icon;

  return (
    <DropdownMenuItem asChild>
      <Link
        href={child.url}
        onClick={onSelect}
        className="flex cursor-pointer items-center gap-2"
      >
        <ChildIcon size={16} strokeWidth={2.5} />
        {child.name}
        {child.badge && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {child.badge}
          </span>
        )}
      </Link>
    </DropdownMenuItem>
  );
}

export function NavBar({ items, className }: NavBarProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    const currentItem = findActiveNavItem(items, pathname);
    setActiveTab(currentItem ? currentItem.name : null);
  }, [pathname, items]);

  return (
    <div className={cn("z-50", className)}>
      <div className="flex items-center gap-0.5 bg-background/5 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;

          if (item.disabled) {
            return (
              <span
                key={item.name}
                className="relative text-xs font-semibold px-3.5 py-2 rounded-full whitespace-nowrap cursor-not-allowed text-foreground/30 select-none"
                title="Coming soon"
              >
                <span className="hidden md:inline">{item.name}</span>
                <span className="md:hidden">
                  <Icon size={18} strokeWidth={2.5} />
                </span>
              </span>
            );
          }

          if (item.children?.length) {
            return (
              <NavDropdown
                key={item.name}
                item={item}
                isActive={isActive}
                onSelect={setActiveTab}
              />
            );
          }

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                "relative cursor-pointer text-xs font-semibold px-3.5 py-2 rounded-full transition-colors whitespace-nowrap",
                "text-foreground/80 hover:text-primary",
                isActive && "bg-muted text-primary",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && <NavLamp />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
