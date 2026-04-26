"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

type ProductLite = {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  imageUrl: string | null;
};

interface NavbarSearchProps {
  variant: "desktop" | "mobile";
  onMobileClose?: () => void;
}

export function NavbarSearch({ variant, onMobileClose }: NavbarSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProductLite[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<{ products?: ProductLite[] }>(
            `/products?q=${encodeURIComponent(term)}&limit=8&page=1`
          );
          const body = res.data;
          const list = Array.isArray(body) ? body : body?.products ?? [];
          setItems(list);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 280);

    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    onMobileClose?.();
    router.push(`/catalogue?q=${encodeURIComponent(term)}`);
  }

  const showDropdown = open && q.trim().length >= 2;
  const formClass =
    variant === "desktop" ? "nav-search-wrap" : "nav-mobile-search";

  return (
    <div ref={wrapRef} className={variant === "desktop" ? "nav-search-outer" : "nav-mobile-search-outer"}>
      <form className={formClass} onSubmit={submit} role="search">
        <Search size={16} className="nav-search-icon" />
        <input
          type="text"
          placeholder='Search by "Biscuits"'
          className="nav-search-input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          autoComplete="off"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {variant === "desktop" && (
          <button type="submit" className="nav-search-submit" aria-label="Search">
            <Search size={16} />
          </button>
        )}
      </form>

      {showDropdown && (
        <div
          id={listId}
          className="nav-search-dropdown"
          role="listbox"
        >
          {loading && (
            <div className="nav-search-dropdown-status">Searching…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="nav-search-dropdown-status">No products found</div>
          )}
          {!loading &&
            items.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                role="option"
                className="nav-search-dropdown-item"
                onClick={() => {
                  setOpen(false);
                  onMobileClose?.();
                }}
              >
                <span className="nav-search-dropdown-thumb">
                  <img
                    src={getImageUrl(p.imageUrl)}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-md object-contain"
                  />
                </span>
                <span className="nav-search-dropdown-text">
                  <span className="nav-search-dropdown-name">{p.name}</span>
                  {p.brand ? (
                    <span className="nav-search-dropdown-meta">{p.brand}</span>
                  ) : null}
                </span>
                <span className="nav-search-dropdown-price">
                  Rs {p.price.toFixed(0)}
                </span>
              </Link>
            ))}
          {!loading && q.trim().length >= 2 && (
            <Link
              href={`/catalogue?q=${encodeURIComponent(q.trim())}`}
              className="nav-search-dropdown-footer"
              onClick={() => {
                setOpen(false);
                onMobileClose?.();
              }}
            >
              View all results
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
