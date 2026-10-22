import { useState } from "react";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { imageUrl } from "../lib/format";
import SafeImage from "../components/SafeImage";
import { usePagedDesigns, useSentinel, useDebounced } from "../hooks/useDesigns";
import { B } from "../lib/brand";

const PAGE_SIZE = 20;

/**
 * Admin "Your designs" section:
 *  - server-side search (debounced), category filter, sort
 *  - streams 20 at a time while scrolling (works with 500+ designs)
 *  - bump `refreshKey` after an upload to reload the first page
 */
export default function AdminDesigns({ user, categories, industry, refreshKey, onAdd, onView, onToast }) {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [sort, setSort] = useState("newest");
    const [deletingId, setDeletingId] = useState(null);

    const q = useDebounced(search, 300).trim();
    const filtering = q !== "" || category !== "all";

    const {
        items, total, hasMore, loading, loadingMore, error, loadMore, retry, removeLocal,
    } = usePagedDesigns({ category, q, sort, limit: PAGE_SIZE, refreshKey, industry });

    const sentinelRef = useSentinel(loadMore, {
        enabled: hasMore && !loading && !error,
        watch: items.length,
    });

    const removeDesign = async (design) => {
        if (!confirm(`Remove “${design.name}” from the studio?`)) return;
        setDeletingId(design.id);
        try {
            await api.delete(`/api/designs/${design.id}`);
            removeLocal(design.id);
            onToast?.("ok", `${B.Item} removed`);
        } catch (err) {
            onToast?.("err", err.response?.data?.message || "Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <section className="mt-10 sm:mt-12">
            {/* Title + add */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="serif text-xl font-semibold sm:text-2xl">Your {B.items}</h2>
                    <p className="text-xs text-[#8a6d53] sm:text-sm">
                        {loading && items.length === 0
                            ? "Loading…"
                            : filtering
                                ? `${total} matching ${total === 1 ? B.item : B.items}`
                                : `${total} ${total === 1 ? B.item : B.items} in the catalogue`}
                    </p>
                </div>
                <button
                    onClick={onAdd}
                    className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[#24170f] px-5 py-2.5 text-sm font-semibold text-white sm:self-auto"
                >
                    <Plus size={15} /> Add {B.item}
                </button>
            </div>

            {/* Search + filters */}
            <div className="mb-5 grid gap-2.5 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a38b74]"
                    />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, description or category…"
                        className="w-full rounded-full border border-[#ded0bc] bg-white py-2.5 pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            title="Clear search"
                            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[#8a6d53] hover:bg-[#f1e6d8]"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-full border border-[#ded0bc] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="rounded-full border border-[#ded0bc] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                </select>
            </div>

            {/* Grid */}
            {loading && items.length === 0 ? (
                <Skeletons count={8} />
            ) : items.length === 0 && !error ? (
                <div className="rounded-3xl border border-dashed border-[#d9c7b0] bg-white p-10 text-center text-sm text-[#8a6d53] sm:p-12">
                    {filtering ? (
                        `No ${B.items} match your search.`
                    ) : (
                        <>No {B.items} yet — click <strong>Add {B.item}</strong> to upload your first one to the catalogue.</>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {items.map((d, i) => (
                        <div
                            key={d.id}
                            className="group relative overflow-hidden rounded-2xl border border-[#eadfce] bg-white"
                        >
                            <div
                                className="aspect-[4/5] cursor-zoom-in bg-[#eadcc9]"
                                onClick={() => onView({ src: imageUrl(d.image), alt: d.name })}
                            >
                                <SafeImage
                                    src={imageUrl(d.image, "thumb")}
                                    alt={d.name}
                                    eager={i < 4}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="p-2.5 sm:p-3">
                                <div className="text-[9px] uppercase tracking-[.14em] text-[#9a7352] sm:text-[10px] sm:tracking-[.16em]">
                                    {d.categoryName}
                                </div>
                                <div className="truncate text-xs font-semibold sm:text-sm">{d.name}</div>
                                <div className="mt-0.5 truncate text-[10px] text-[#9a846f]">by {d.uploadedBy || "-"}</div>
                            </div>

                            {(user?.role === "SUPERADMIN" || d.uploadedById === user?.id) && <button
                                onClick={() => removeDesign(d)}
                                disabled={deletingId === d.id}
                                aria-label={`Remove ${B.item}`}
                                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#7d3f24] shadow-sm transition disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                                {deletingId === d.id
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Trash2 size={14} />}
                            </button>}
                        </div>
                    ))}
                    {loadingMore && Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={`s${i}`} />)}
                </div>
            )}

            {/* Sentinel: next page loads before the bottom is reached */}
            {hasMore && !error && (
                <div ref={sentinelRef} className="mt-8 flex h-10 items-center justify-center gap-2 text-[#8a6d53]">
                    <Loader2 size={18} className={loadingMore ? "animate-spin" : "opacity-40"} />
                    <span className="text-xs">Loading more {B.items}…</span>
                </div>
            )}

            {error && (
                <div className="mt-6 rounded-2xl border border-[#f0d3cd] bg-[#fdf1ee] p-5 text-center">
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
                <div className="mt-8 text-center text-xs text-[#8a6d53]">
                    That's all <strong>{total}</strong> {filtering ? `matching ${B.items}` : B.items}
                </div>
            )}
        </section>
    );
}

function SkeletonTile() {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#eadfce] bg-white">
            <div className="aspect-[4/5] animate-pulse bg-[#eee3d4]" />
            <div className="p-3">
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-[#eee3d4]" />
                <div className="mt-2 h-3.5 w-2/3 animate-pulse rounded bg-[#eee3d4]" />
            </div>
        </div>
    );
}

function Skeletons({ count }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
    );
}