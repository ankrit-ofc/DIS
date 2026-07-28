import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import type { SalesBuyer } from "../lib/sales";

/** Below this the server browses instead of filtering — see GET /sales/buyers. */
export const MIN_BUYER_SEARCH = 2;

const PAGE_SIZE = 20;

/**
 * Shop lookup for the rep-facing screens (the order-flow buyer picker and the
 * find-a-shop directory).
 *
 * With an empty field this browses every active buyer rather than showing
 * nothing: a rep standing in a shop needs to find it without already knowing
 * its name. Recent shops are fetched separately so the picker can pin the
 * rep's usual stops above the full list.
 */
export function useBuyerSearch() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SalesBuyer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  /** True only for a first page — a "load more" must not blank the list. */
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recent, setRecent] = useState<SalesBuyer[]>([]);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guards against a slow early response overwriting a newer one. */
  const requestId = useRef(0);

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
        // Non-fatal — the full list below is the primary surface.
      });
  }, []);

  useFocusEffect(loadRecent);

  const fetchPage = useCallback(async (q: string, p: number) => {
    const id = ++requestId.current;
    p === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const params: Record<string, any> = { page: p, limit: PAGE_SIZE };
      if (q.trim().length >= MIN_BUYER_SEARCH) params.search = q.trim();
      const res = await api.get("/sales/buyers", { params });
      if (id !== requestId.current) return; // superseded
      const list: SalesBuyer[] = res.data?.buyers ?? [];
      setResults((prev) => (p === 1 ? list : [...prev, ...list]));
      setTotal(res.data?.total ?? list.length);
      setHasMore(!!res.data?.hasMore);
      setError("");
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err?.message ?? "Could not load shops.");
      if (p === 1) setResults([]);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    setPage(1);
    void fetchPage(query, 1);
  }, [query, fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1;
    setPage(next);
    void fetchPage(query, next);
  }, [hasMore, loadingMore, loading, page, query, fetchPage]);

  /** Skip the debounce — for the keyboard's search key. */
  const searchNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setQuery(search);
  }, [search]);

  const refresh = useCallback(() => {
    loadRecent();
    setPage(1);
    void fetchPage(query, 1);
  }, [loadRecent, query, fetchPage]);

  return {
    search,
    setSearch,
    /** The debounced term actually sent to the server. */
    query,
    searchNow,
    results,
    total,
    hasMore,
    loadMore,
    loading,
    loadingMore,
    recent,
    refresh,
    error,
    /** True when the server is filtering rather than browsing. */
    filtering: query.trim().length >= MIN_BUYER_SEARCH,
  };
}
