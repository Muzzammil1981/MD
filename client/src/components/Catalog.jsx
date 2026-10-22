import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, ImagePlus, Loader2, Search, X } from "lucide-react";
import { api } from "../lib/api";
import { imageUrl, currency } from "../lib/format";
import SafeImage from "./SafeImage";
import { usePagedDesigns, useSentinel, useDebounced } from "../hooks/useDesigns";
import { B } from "../lib/brand";

const PAGE_SIZE = 12;

/* One random cover + count per category (for the category cards) */
function useSummary(seed) {
    const [data, setData] = useState(null);
    useEffect(() => {
        let alive = true;
        api.get("/api/designs/summary", { params: { seed } })
            .then(({ data }) => { if (alive) setData(data); })
            .catch(() => { /* cards fall back to a gradient */ });
        return () => { alive = false; };
    }, [seed]);
    return data;
}

/* =========================================================
   CATALOG
   - Home (all styles, no search): random order, new on every page load
   - Category / search: newest first
   - Always streams in PAGE_SIZE at a time while scrolling
   ========================================================= */
export default function Catalog({
    categories, activeCategory, setActiveCategory,
    search, setSearch, onSelect, onAdmin,
}) {
    /* new seed per page load => different random order after every refresh */
    const [seed] = useState(() => Math.floor(Math.random() * 2147483647));

    const q = search.trim();
    const isHome = activeCategory === "all" && !q;

    const {
        items, total, hasMore, loading, loadingMore, error, loadMore, retry,
    } = usePagedDesigns({
        category: activeCategory,
        q,
        sort: isHome ? "random" : "newest",
        seed,
        limit: PAGE_SIZE,
    });

    const summary = useSummary(seed);

    const sentinelRef = useSentinel(loadMore, {
        enabled: hasMore && !loading && !error,
        watch: items.length,
    });

    const activeInfo = categories.find(c => c.id === activeCategory);

    return (
        <section id="catalog" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[.25em] text-[#9b6d43]">{B.catalogKicker}</p>
                    <h2 className="serif mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{B.catalogTitle}</h2>
                </div>

                <SearchBox
                    value={search}
                    onChange={setSearch}
                    categories={categories}
                    total={total}
                    onPickCategory={setActiveCategory}
                    onPickDesign={onSelect}
                />
            </div>

            <div className="mt-12">
                {isHome && (
                    <CategoryShowcase
                        categories={categories}
                        summary={summary}
                        setActiveCategory={setActiveCategory}
                    />
                )}

                {activeCategory !== "all" && !q && (
                    <div className="mb-8 rounded-3xl border border-[#eadfce] bg-[#fffdf9] p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-xs font-bold uppercase tracking-[.22em] text-[#9b6d43]">Style</div>
                                <h3 className="serif mt-1 text-3xl">{activeInfo?.name}</h3>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#715e4e]">{activeInfo?.description}</p>
                            </div>
                            <div className="shrink-0 rounded-full bg-[#f0e3d3] px-3 py-1 text-xs font-semibold">
                                {total} design{total === 1 ? "" : "s"}
                            </div>
                        </div>
                    </div>
                )}

                {q && (
                    <p className="mb-6 text-sm text-[#715e4e]">
                        {loading ? "Searching…" : `${total} ${total === 1 ? B.item : B.items} found for “${q}”`}
                    </p>
                )}

                <div className={isHome ? "mt-16" : ""}>
                    {isHome && (
                        <div className="mb-7 flex items-end justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[.22em] text-[#9b6d43]">Discover</p>
                                <h3 className="serif mt-1 text-3xl">A few favourites to begin.</h3>
                                <p className="mt-1 text-xs text-[#8a6d53]">Keep scrolling — more {B.items} load as you go.</p>
                            </div>
                            <button
                                onClick={() => setActiveCategory(B.firstCategoryId)}
                                className="hidden items-center gap-1 text-sm font-semibold text-[#7d3f24] sm:flex"
                            >
                                {B.browseLabel} <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    <DesignGrid
                        items={items}
                        loading={loading}
                        loadingMore={loadingMore}
                        onSelect={onSelect}
                    />

                    {/* Sentinel: reaching it (900px early) loads the next page */}
                    {hasMore && !error && (
                        <div ref={sentinelRef} className="mt-12 flex h-10 items-center justify-center gap-2 text-[#8a6d53]">
                            <Loader2 size={20} className={loadingMore ? "animate-spin" : "opacity-40"} />
                            <span className="text-xs">Loading more {B.items}…</span>
                        </div>
                    )}

                    {error && (
                        <div className="mt-10 rounded-2xl border border-[#f0d3cd] bg-[#fdf1ee] p-5 text-center">
                            <p className="text-sm text-[#8c392d]">{error}</p>
                            <button
                                onClick={retry}
                                className="mt-3 rounded-full bg-[#24170f] px-5 py-2 text-xs font-semibold text-white"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {!loading && !hasMore && !error && items.length > PAGE_SIZE && (
                        <div className="mt-12 text-center text-xs text-[#8a6d53]">
                            You've seen all <strong>{total}</strong> designs
                        </div>
                    )}

                    {!loading && !error && items.length === 0 && (
                        <EmptyState search={q} category={activeInfo?.name} onAdmin={onAdmin} />
                    )}
                </div>
            </div>
        </section>
    );
}

/* =========================================================
   SEARCH BOX — debounced, server-side live suggestions
   ========================================================= */
function SearchBox({ value, onChange, categories, total, onPickCategory, onPickDesign }) {
    const [input, setInput] = useState(value || "");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const boxRef = useRef(null);

    const debounced = useDebounced(input, 300);
    const q = debounced.trim();

    /* tell the grid what to search for */
    useEffect(() => {
        onChange(debounced);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    /* dropdown suggestions come from the server (top 5) */
    useEffect(() => {
        if (!q || !open) { setResults([]); setSearching(false); return; }
        const controller = new AbortController();
        setSearching(true);
        api.get("/api/designs", {
            params: { q, page: 1, limit: 5, sort: "newest" },
            signal: controller.signal,
        })
            .then(({ data }) => setResults(Array.isArray(data?.items) ? data.items : []))
            .catch(() => { /* ignore aborted / failed */ })
            .finally(() => { if (!controller.signal.aborted) setSearching(false); });
        return () => controller.abort();
    }, [q, open]);

    useEffect(() => {
        const handler = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const lower = q.toLowerCase();
    const matchedCategories = lower
        ? categories
            .filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.shortName.toLowerCase().includes(lower) ||
                c.description.toLowerCase().includes(lower)
            )
            .slice(0, 3)
        : [];

    const hasResults = matchedCategories.length > 0 || results.length > 0;

    const clearAll = () => {
        setInput("");
        onChange("");
        setOpen(false);
    };

    return (
        <div ref={boxRef} className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a38b74]" size={18} />
            <input
                value={input}
                onChange={e => { setInput(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={`Search ${B.items}, categories…`}
                className="w-full rounded-full border border-[#ded0bc] bg-white py-3.5 pl-11 pr-24 text-sm outline-none ring-[#9b5d32] transition focus:ring-2"
            />

            {input && (
                <button
                    onClick={clearAll}
                    className="absolute right-14 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#8a6d53] hover:bg-[#f1e6d8]"
                    title="Clear search"
                >
                    <X size={14} />
                </button>
            )}

            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#f1cf8a]/40 px-2 py-0.5 text-[10px] font-bold text-[#7d3f24]">
                {total}
            </div>

            {open && q && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-2xl border border-[#eadfce] bg-white p-2 shadow-2xl">
                    {!hasResults ? (
                        <div className="py-8 text-center text-sm text-[#8a6d53]">
                            {searching ? (
                                <Loader2 size={18} className="mx-auto animate-spin" />
                            ) : (
                                <>
                                    <div className="serif text-lg">No matches for "{input}"</div>
                                    <div className="mt-1 text-xs">Try a different keyword</div>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {matchedCategories.length > 0 && (
                                <div className="mb-1">
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#8a6d53]">
                                        Categories
                                    </div>
                                    {matchedCategories.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { onPickCategory(c.id); setInput(""); onChange(""); setOpen(false); }}
                                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#faf5ed]"
                                        >
                                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f1cf8a]/40 text-[10px] font-bold text-[#7d3f24]">
                                                {c.shortName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-semibold">{c.name}</div>
                                                <div className="truncate text-xs text-[#8a6d53]">{c.accent}</div>
                                            </div>
                                            <ChevronRight size={14} className="text-[#a38b74]" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.length > 0 && (
                                <div>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#8a6d53]">
                                        Designs
                                    </div>
                                    {results.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => { onPickDesign(d); setOpen(false); }}
                                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#faf5ed]"
                                        >
                                            <SafeImage
                                                src={imageUrl(d.image, "thumb")}
                                                alt=""
                                                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-semibold">{d.name}</div>
                                                <div className="truncate text-xs text-[#8a6d53]">
                                                    {d.categoryName} · {currency(d.price)}
                                                </div>
                                            </div>
                                            <ArrowRight size={14} className="text-[#a38b74]" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/* =========================================================
   CATEGORY CARDS — cover image + count come from /summary
   ========================================================= */
function CategoryShowcase({ categories, summary, setActiveCategory }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c, i) => {
                const info = summary?.categories?.[c.id];
                const cover = info?.cover;
                return (
                    <button
                        key={c.id}
                        onClick={() => setActiveCategory(c.id)}
                        className={`group relative overflow-hidden rounded-[28px] border border-[#eadfce] bg-[#efe2d2] text-left ${i === 0 ? "lg:col-span-2 lg:row-span-2" : ""}`}
                    >
                        <div className={`aspect-[4/3] ${i === 0 ? "lg:aspect-auto lg:h-full lg:min-h-[450px]" : ""}`}>
                            {cover ? (
                                <SafeImage
                                    src={imageUrl(cover.image, i === 0 ? undefined : "thumb")}
                                    alt={cover.name}
                                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="h-full w-full bg-gradient-to-br from-[#eadac7] to-[#d1b595]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1f130d]/85 via-[#1f130d]/15 to-transparent" />
                            {info?.count > 0 && (
                                <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#24170f]">
                                    {info.count} design{info.count === 1 ? "" : "s"}
                                </span>
                            )}
                            <div className="absolute bottom-0 p-6 text-white">
                                <div className="text-[10px] uppercase tracking-[.24em] text-[#f0d5a4]">{c.accent}</div>
                                <div className="serif mt-1 text-2xl font-semibold">{c.name}</div>
                                <div className="mt-2 max-w-sm text-xs leading-5 text-white/75">{c.description}</div>
                                <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold">Explore <ArrowRight size={14} /></div>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

/* =========================================================
   GRID + CARDS
   ========================================================= */
function SkeletonCard() {
    return (
        <div>
            <div className="aspect-[4/5] animate-pulse rounded-[24px] bg-[#eee3d4]" />
            <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-[#eee3d4]" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-[#eee3d4]" />
        </div>
    );
}

const GRID = "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-5 md:grid-cols-3 lg:grid-cols-4";

function DesignGrid({ items, loading, loadingMore, onSelect }) {
    if (loading && items.length === 0) {
        return (
            <div className={GRID}>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
        );
    }
    return (
        <div className={GRID}>
            {items.map((d, i) => (
                <DesignCard key={d.id} design={d} onSelect={onSelect} priority={i < 4} />
            ))}
            {loadingMore && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`s${i}`} />)}
        </div>
    );
}

function DesignCard({ design, onSelect, priority = false }) {
    return (
        <article className="group">
            <button
                onClick={() => onSelect(design)}
                className="relative block w-full overflow-hidden rounded-[24px] bg-[#eadcc9] text-left shadow-sm"
            >
                <div className="aspect-[4/5]">
                    <SafeImage
                        src={imageUrl(design.image, "thumb")}
                        alt={design.name}
                        eager={priority}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                </div>
                <div className="absolute inset-x-3 top-3 flex justify-between">
                    {design.featured && (
                        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.16em]">Featured</span>
                    )}
                    <span className="ml-auto rounded-full bg-[#24170f]/80 px-2.5 py-1 text-[9px] font-bold text-white">
                        {currency(design.price)}
                    </span>
                </div>
            </button>
            <div className="px-1 pt-3">
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9a7352]">{design.categoryName}</div>
                <h3 className="mt-1 font-semibold">{design.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#806b58]">
                    {design.description || B.defaultDescription}
                </p>
                <button onClick={() => onSelect(design)} className="mt-3 text-xs font-bold text-[#7d3f24]">
                    View design →
                </button>
            </div>
        </article>
    );
}

function EmptyState({ search, category, onAdmin }) {
    const title = search
        ? `No matching ${B.items} yet`
        : category
            ? `No ${category} ${B.items} yet`
            : `Your collection is ready for its first ${B.item}`;
    return (
        <div className="rounded-3xl border border-dashed border-[#d9c7b0] bg-[#fffdf9] px-6 py-16 text-center">
            <ImagePlus className="mx-auto text-[#9b7656]" size={34} />
            <h3 className="serif mt-4 text-2xl">{title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#806b58]">
                Add your actual {B.item} images, descriptions and prices from the admin panel.
            </p>
            <button onClick={onAdmin} className="mt-5 rounded-full bg-[#24170f] px-5 py-3 text-sm font-semibold text-white">
                Add a design
            </button>
        </div>
    );
}