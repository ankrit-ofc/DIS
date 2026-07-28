import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import type { SalesBuyer } from "../lib/sales";

/** Matches the API: GET /sales/buyers returns [] for anything shorter. */
export const MIN_BUYER_SEARCH = 2;

/**
 * Debounced shop lookup for the rep-facing screens (the order-flow buyer
 * picker and the find-a-shop directory), plus the rep's recent shops.
 *
 * Recent shops double as the browse surface: /sales/buyers needs a query, so
 * with an empty field there is nothing else to show. They are refetched on
 * focus, since placing an order changes the list.
 */
export function useBuyerSearch() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SalesBuyer[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<SalesBuyer[]>([]);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(search), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search]);

  const loadRecent = useCallback(() => {
    api
      .get("/sales/recent-buyers")
      .then((r) => setRecent(r.data?.buyers ?? []))
      .catch(() => {
        // Non-fatal — search still works.
      });
  }, []);

  useFocusEffect(loadRecent);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_BUYER_SEARCH) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setError("");
    api
      .get("/sales/buyers", { params: { search: q } })
      .then((r) => {
        if (!cancelled) setResults(r.data?.buyers ?? []);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Could not search shops.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  /** Skip the debounce — for the keyboard's search key. */
  const searchNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setQuery(search);
  }, [search]);

  return {
    search,
    setSearch,
    /** The debounced term actually sent to the server. */
    query,
    searchNow,
    results,
    searching,
    recent,
    /** Replace one shop in the cached lists after it is updated (e.g. pinned). */
    replaceBuyer: useCallback((updated: SalesBuyer) => {
      const swap = (list: SalesBuyer[]) =>
        list.map((b) => (b.id === updated.id ? updated : b));
      setResults(swap);
      setRecent(swap);
    }, []),
    refreshRecent: loadRecent,
    error,
    /** True once the query is long enough for the server to answer it. */
    searched: query.trim().length >= MIN_BUYER_SEARCH,
  };
}
