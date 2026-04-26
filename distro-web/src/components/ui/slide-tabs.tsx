"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SlideTabItem = {
  href: string;
  label: string;
};

export type CursorPosition = {
  left: number;
  width: number;
  opacity: number;
};

export type SlideTabsProps = {
  items: SlideTabItem[];
  /** Override active path (defaults to `usePathname()`) */
  pathname?: string | null;
  className?: string;
};

function isActiveRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function applyActivePosition(
  items: SlideTabItem[],
  activePath: string | null,
  itemRefs: React.MutableRefObject<(HTMLLIElement | null)[]>,
  setPosition: React.Dispatch<React.SetStateAction<CursorPosition>>
) {
  const idx = items.findIndex((item) => isActiveRoute(activePath, item.href));
  const el = itemRefs.current[idx];
  if (!el) return;
  const { width } = el.getBoundingClientRect();
  setPosition({
    left: el.offsetLeft,
    width,
    opacity: 1,
  });
}

/**
 * Pill nav with sliding highlight on hover + synced position for the active route.
 * Inactive labels use dark text on white; active/hovered tab uses white on the black pill
 * (avoids mix-blend-difference, which hides text on white when the pill is not behind it).
 */
export function SlideTabs({ items, pathname: pathnameProp, className }: SlideTabsProps) {
  const routerPath = usePathname();
  const activePath = pathnameProp ?? routerPath;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const [position, setPosition] = useState<CursorPosition>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useLayoutEffect(() => {
    if (items.length === 0) return;
    applyActivePosition(items, activePath, itemRefs, setPosition);
  }, [activePath, items]);

  function isLabelOnPill(index: number): boolean {
    if (hoveredIndex !== null) return index === hoveredIndex;
    return isActiveRoute(activePath, items[index]?.href ?? "");
  }

  return (
    <ul
      onMouseLeave={() => {
        setHoveredIndex(null);
        applyActivePosition(items, activePath, itemRefs, setPosition);
      }}
      className={cn(
        "relative mx-auto flex w-fit min-w-0 flex-nowrap items-stretch rounded-full border-2 border-black bg-white p-1",
        className
      )}
    >
      {items.map((item, i) => (
        <li
          key={item.href}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          onMouseEnter={() => {
            setHoveredIndex(i);
            const el = itemRefs.current[i];
            if (!el) return;
            const { width } = el.getBoundingClientRect();
            setPosition({
              left: el.offsetLeft,
              width,
              opacity: 1,
            });
          }}
          className="relative z-10 flex cursor-pointer items-center whitespace-nowrap"
        >
          <Link
            href={item.href}
            className={cn(
              "block px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors md:px-5 md:py-3 md:text-sm",
              isLabelOnPill(i) ? "text-white" : "text-neutral-900"
            )}
          >
            {item.label}
          </Link>
        </li>
      ))}

      <SlideCursor position={position} />
    </ul>
  );
}

function SlideCursor({ position }: { position: CursorPosition }) {
  return (
    <motion.li
      aria-hidden
      layout={false}
      animate={{
        left: position.left,
        width: position.width,
        opacity: position.opacity,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="pointer-events-none absolute inset-y-1 left-0 z-0 rounded-full bg-black"
    />
  );
}

/** Full-viewport demo wrapper */
export function SlideTabsExample() {
  return (
    <div className="min-h-screen w-full bg-neutral-100 py-20">
      <SlideTabs
        items={[
          { href: "/", label: "Home" },
          { href: "/catalogue", label: "Pricing" },
          { href: "/coverage", label: "Features" },
          { href: "/faq", label: "Docs" },
          { href: "/about", label: "Blog" },
        ]}
      />
    </div>
  );
}
