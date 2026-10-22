import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { B } from "../lib/brand";

const isCancel = (err) =>
    err?.code === "ERR_CANCELED" || err?.name === "CanceledError" || err?.name === "AbortError";

/* ---------------------------------------------------------
   Debounce a fast-changing value (search boxes)
   --------------------------------------------------------- */
export function useDebounced(value, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/* ---------------------------------------------------------
   Server-side paged designs.
   - Changing category / q / sort / seed resets to page 1
   - Stale responses are ignored, in-flight requests are aborted
   - Page results are de-duplicated by id
   - refreshKey: bump it to reload page 1 without clearing the list
   --------------------------------------------------------- */
export function usePagedDesigns({
    category = "all",
    q = "",
    sort = "newest",
    seed,
    limit = 12,
    refreshKey = 0,
    industry,            // admin screens only: items of THIS industry (uses /api/designs/admin)
}) {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);        // first page
    const [loadingMore, setLoadingMore] = useState(false); // next pages
    const [error, setError] = useState("");

    const pageRef = useRef(0);
    const reqRef = useRef(0);
    const ctrlRef = useRef(null);

    const load = useCallback(async (page) => {
        const id = ++reqRef.current;
        ctrlRef.current?.abort();
        const controller = new AbortController();
        ctrlRef.current = controller;

        if (page === 1) setLoading(true); else setLoadingMore(true);
        setError("");

        try {
            const { data } = await api.get(industry ? "/api/designs/admin" : "/api/designs", {
                params: {
                    industry,
                    page,
                    limit,
                    sort,
                    seed,
                    category: category === "all" ? undefined : category,
                    q: q || undefined,
                },
                signal: controller.signal,
            });
            if (id !== reqRef.current) return;

            const next = Array.isArray(data?.items) ? data.items : [];
            setItems(prev => {
                if (page === 1) return next;
                const seen = new Set(prev.map(d => d.id));
                return [...prev, ...next.filter(d => !seen.has(d.id))];
            });
            setTotal(data?.total ?? next.length);
            setHasMore(Boolean(data?.hasMore));
            pageRef.current = page;
        } catch (err) {
            if (isCancel(err) || id !== reqRef.current) return;
            setError(err.response?.data?.message || `Could not load ${B.items}`);
        } finally {
            if (id === reqRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [category, q, sort, seed, limit, industry]);

    /* Filters changed (or first mount): start over */
    useEffect(() => {
        pageRef.current = 0;
        setItems([]);
        setTotal(0);
        setHasMore(false);
        load(1);
        return () => ctrlRef.current?.abort();
    }, [load]);

    /* refreshKey bumped: reload page 1 in place */
    const lastKey = useRef(refreshKey);
    useEffect(() => {
        if (lastKey.current === refreshKey) return;
        lastKey.current = refreshKey;
        load(1);
    }, [refreshKey, load]);

    const loadMore = useCallback(() => {
        if (loading || loadingMore || !hasMore || error) return;
        load(pageRef.current + 1);
    }, [loading, loadingMore, hasMore, error, load]);

    const retry = useCallback(() => load(Math.max(1, pageRef.current + 1)), [load]);

    const removeLocal = useCallback((id) => {
        setItems(prev => prev.filter(d => d.id !== id));
        setTotal(t => Math.max(0, t - 1));
    }, []);

    return { items, total, hasMore, loading, loadingMore, error, loadMore, retry, removeLocal };
}

/* ---------------------------------------------------------
   Infinite-scroll sentinel.
   Put the returned ref on an element at the end of the list.
   `watch` (e.g. items.length) re-creates the observer after each page,
   so a next page still loads if the sentinel is already on screen.
   --------------------------------------------------------- */
export function useSentinel(onVisible, { enabled = true, watch, rootMargin = "900px 0px" } = {}) {
    const ref = useRef(null);
    const cb = useRef(onVisible);
    cb.current = onVisible;

    useEffect(() => {
        const el = ref.current;
        if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
        const obs = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) cb.current(); },
            { rootMargin }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [enabled, watch, rootMargin]);

    return ref;
}