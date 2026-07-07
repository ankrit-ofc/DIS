"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";

export interface CartIssue {
  id: string;
  name: string;
  type: "STOCK" | "INACTIVE" | "PRICE";
  requested: number;
  available: number;
  /** Current server price (per sellUnit) when type === "PRICE" */
  price?: number;
}

interface ValidateLine {
  productId: string | null;
  name?: string;
  requested: number;
  ok: boolean;
  inactive: boolean;
  available: number;
  price?: number;
  priceChanged: boolean;
}

/**
 * Server-side re-validation of the client cart (POST /cart/validate).
 * Runs on mount and on demand; refreshes each line's maxOrderQty cap in the
 * store but NEVER auto-adjusts quantities — the buyer decides via the inline
 * "Update to N" / remove actions.
 */
export function useCartValidation() {
  const { items, applyValidation } = useCartStore();
  const token = useAuthStore((s) => s.token);
  const [issues, setIssues] = useState<CartIssue[]>([]);
  const [validating, setValidating] = useState(false);

  const revalidate = useCallback(async () => {
    const current = useCartStore.getState().items;
    if (!token || current.length === 0) {
      setIssues([]);
      return;
    }
    setValidating(true);
    try {
      const res = await api.post("/cart/validate", {
        items: current.map((i) => ({ productId: i.id, qty: i.qty, price: i.price })),
      });
      const lines: ValidateLine[] = res.data.lines ?? [];
      const found: CartIssue[] = [];
      const capUpdates: Array<{ id: string; maxOrderQty?: number }> = [];
      for (const line of lines) {
        if (!line.productId) continue;
        const item = current.find((i) => i.id === line.productId);
        if (!item) continue;
        capUpdates.push({ id: line.productId, maxOrderQty: line.available });
        if (line.inactive) {
          found.push({ id: line.productId, name: item.name, type: "INACTIVE", requested: line.requested, available: 0 });
        } else if (line.requested > line.available) {
          found.push({ id: line.productId, name: item.name, type: "STOCK", requested: line.requested, available: line.available });
        } else if (line.priceChanged) {
          found.push({ id: line.productId, name: item.name, type: "PRICE", requested: line.requested, available: line.available, price: line.price });
        }
      }
      applyValidation(capUpdates);
      setIssues(found);
    } catch {
      // Network/auth failure — checkout re-validates server-side anyway.
    } finally {
      setValidating(false);
    }
  }, [token, applyValidation]);

  // Re-run when the line-up changes (not on every qty tick).
  const lineup = items.map((i) => i.id).join(",");
  useEffect(() => {
    void revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup, token]);

  return { issues, validating, revalidate };
}
