"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface PillNavItem {
  /** Label shown in the pill */
  name: string;
  /** Route path (starts with `/`) or hash (`#...`) */
  href: string;
}

interface PillNavProps {
  items?: PillNavItem[];
  /** If provided, the component is controlled by name. */
  activeName?: string;
  /** If provided (e.g. from `usePathname()`), the active pill matches the item whose href is a prefix of pathname. */
  pathname?: string | null;
  onChange?: (item: PillNavItem) => void;
  className?: string;
}

const DEFAULT_ITEMS: PillNavItem[] = [
  { name: "Catalogue", href: "/catalogue" },
  { name: "Track Order", href: "/track" },
  { name: "Coverage", href: "/coverage" },
];

function matchesPath(pathname: string | null | undefined, href: string) {
  if (!pathname || !href.startsWith("/")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function PillNav({
  items = DEFAULT_ITEMS,
  activeName,
  pathname,
  onChange,
  className,
}: PillNavProps) {
  const pathMatch = items.find((i) => matchesPath(pathname, i.href))?.name;
  const [internalActive, setInternalActive] = useState(
    pathMatch ?? items[0]?.name ?? ""
  );
  const active = activeName ?? pathMatch ?? internalActive;

  function handleClick(item: PillNavItem) {
    if (activeName === undefined) setInternalActive(item.name);
    onChange?.(item);
  }

  return (
    /* Outer wrapper handles mobile horizontal scroll without clipping the glow. */
    <div
      className={cn(
        "mx-auto max-w-full overflow-x-auto px-6 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <nav
        aria-label="Primary"
        className="relative inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/55 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05),0_20px_50px_-10px_rgba(26,75,219,0.25)] backdrop-blur-xl backdrop-saturate-150"
      >
        {items.map((item) => {
          const isActive = item.name === active;
          const isRoute = item.href.startsWith("/");
          const common = cn(
            "relative isolate shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 text-sm leading-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a4bdb] focus-visible:ring-offset-2",
            isActive
              ? "font-bold text-[#1a4bdb]"
              : "font-semibold text-slate-900 hover:bg-slate-900/5"
          );

          const content = (
            <>
              {isActive && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-3 -z-20 rounded-full bg-[radial-gradient(closest-side,rgba(26,75,219,0.55),rgba(26,75,219,0.15)_55%,transparent_75%)] blur-xl"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-white to-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_-6px_rgba(26,75,219,0.45)] ring-1 ring-white/80"
                  />
                </>
              )}
              {item.name}
            </>
          );

          if (isRoute) {
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleClick(item)}
                className={common}
              >
                {content}
              </Link>
            );
          }
          return (
            <a
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => handleClick(item)}
              className={common}
            >
              {content}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
