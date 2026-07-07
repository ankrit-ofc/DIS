"use client";

import React from "react";

/**
 * Admin-local design primitives — quiet, flat, dense.
 * Palette: white surfaces, 1px gray borders, ink text, blue reserved for
 * primary actions and active states. No gradients, glows, or pill badges.
 */

// ── Shared class strings ─────────────────────────────────────────────────────
export const card = "bg-white border border-gray-200 rounded-[8px]";

export const btnPrimary =
  "inline-flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-[6px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-ink text-sm font-medium px-4 py-2 rounded-[6px] border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnDanger =
  "inline-flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 text-sm font-medium px-4 py-2 rounded-[6px] border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const input =
  "border border-gray-200 rounded-[6px] px-3 py-2 text-sm text-ink bg-white placeholder:text-gray-400 focus:outline-none focus:border-blue";

export const thBase =
  "text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide";
export const thNum = thBase.replace("text-left", "text-right");

export const tdBase = "px-3 py-2 text-sm text-ink";
export const tdNum = tdBase + " text-right font-grotesk tabular-nums";
export const tdMuted = "px-3 py-2 text-sm text-gray-600";

export const rowHover = "hover:bg-gray-50 transition-colors";

// ── Page header: title left, primary action right ────────────────────────────
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="font-grotesk font-bold text-xl text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

// ── Status shown as plain text with a small colored dot ─────────────────────
const STATUS_DOT: Record<string, string> = {
  PENDING: "#D97706",
  CONFIRMED: "#1A4BDB",
  PROCESSING: "#5C6480",
  DISPATCHED: "#1239B0",
  DELIVERED: "#00C46F",
  CANCELLED: "#DC2626",
  PAID: "#00C46F",
  UNPAID: "#D97706",
  PARTIAL: "#5C6480",
  REFUNDED: "#DC2626",
  ACTIVE: "#00C46F",
  SUSPENDED: "#DC2626",
  OPEN: "#1A4BDB",
  CLOSED: "#5C6480",
  DEBIT: "#DC2626",
  CREDIT: "#00C46F",
  IN: "#00C46F",
  OUT: "#DC2626",
  ADJUSTMENT: "#5C6480",
};

export function StatusDot({ status, label }: { status: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink whitespace-nowrap">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: STATUS_DOT[status] ?? "#9BA3BF" }}
      />
      {label ?? status}
    </span>
  );
}
