import { useEffect, useMemo, useState } from "react";
import { Clock, Sparkles, ShoppingBag, Search, X, Tag, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { imageUrl, currency } from "../lib/format";
import SafeImage from "../components/SafeImage";
import { B } from "../lib/brand";

const PAGE_SIZE = 12;

const getCategory = (design) => {
    const c = design?.category ?? design?.categoryName ?? "";
    return typeof c === "object" && c !== null ? c.name || "" : String(c || "");
};

const pad = (n) => String(n).padStart(2, "0");

export default function EventPage({ event, onAddToCart, onSelect }) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const [sort, setSort] = useState("newest");
    const [visible, setVisible] = useState(PAGE_SIZE);

    /* COUNTDOWN */
    useEffect(() => {
        if (!event?.endDate) return;
        const update = () => {
            const distance = new Date(event.endDate).getTime() - Date.now();
            if (isNaN(distance) || distance <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }
            setTimeLeft({
                days: Math.floor(distance / 86400000),
                hours: Math.floor((distance % 86400000) / 3600000),
                minutes: Math.floor((distance % 3600000) / 60000),
                seconds: Math.floor((distance % 60000) / 1000),
            });
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [event?.endDate]);

    /* LOAD EVENT DESIGNS */
    useEffect(() => {
        const load = async () => {
            if (!event) {
                setError("No event information was provided.");
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                setError("");
                const response = await api.get("/api/designs");
                const all = Array.isArray(response.data) ? response.data : response.data?.designs || [];

                const designIds = Array.isArray(event.designIds) ? event.designIds : [];
                const overrides = event.priceOverrides && typeof event.priceOverrides === "object" ? event.priceOverrides : {};

                const list = (designIds.includes("all") ? all : all.filter((d) => designIds.includes(String(d.id)))).map((d) => {
                    const o = overrides[d.id];
                    return {
                        ...d,
                        originalPrice: d.price,
                        price: o !== undefined && o !== null && o !== "" ? Number(o) : d.price,
                    };
                });
                setDesigns(list);
            } catch (err) {
                console.error(`Failed to load event ${B.items}:`, err);
                setError(err.response?.data?.message || `Unable to load event ${B.items}.`);
                setDesigns([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [event]);

    /* Reset pagination whenever filters change */
    useEffect(() => setVisible(PAGE_SIZE), [query, category, sort]);

    const categories = useMemo(
        () => [...new Set(designs.map(getCategory).filter(Boolean))].sort(),
        [designs]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = designs.filter((d) => {
            const matchesCategory = category === "all" || getCategory(d) === category;
            const haystack = `${d.name || ""} ${d.description || ""} ${getCategory(d)}`.toLowerCase();
            return matchesCategory && (!q || haystack.includes(q));
        });

        const time = (d) => new Date(d.createdAt || d.created_at || 0).getTime() || 0;
        list = [...list].sort((a, b) => {
            if (sort === "price-asc") return Number(a.price) - Number(b.price);
            if (sort === "price-desc") return Number(b.price) - Number(a.price);
            if (sort === "name") return String(a.name).localeCompare(String(b.name));
            if (sort === "oldest") return time(a) - time(b);
            return time(b) - time(a);
        });
        return list;
    }, [designs, query, category, sort]);

    const hasFilters = query || category !== "all";
    const clearFilters = () => {
        setQuery("");
        setCategory("all");
    };

    if (!event) {
        return (
            <div className="min-h-screen bg-[#1b100b] text-[#fff9ef] grid place-items-center px-5">
                <div className="text-center">
                    <Sparkles size={40} className="mx-auto mb-4 text-[#f1cf8a]" />
                    <h1 className="serif text-3xl font-bold">No Active Event</h1>
                    <p className="mt-2 text-[#d9c9b8]">There is currently no active event.</p>
                </div>
            </div>
        );
    }

    const countdown = [
        ...(timeLeft.days > 0 ? [["Days", timeLeft.days]] : []),
        ["Hours", timeLeft.hours],
        ["Mins", timeLeft.minutes],
        ["Secs", timeLeft.seconds],
    ];

    const selectClass =
        "appearance-none rounded-full border border-[#e4d3bd] bg-white py-3 pl-5 pr-10 text-sm font-medium text-[#24170f] outline-none transition focus:border-[#7d3f24] focus:ring-2 focus:ring-[#7d3f24]/20 cursor-pointer";

    return (
        <div className="min-h-screen bg-[#1b100b] text-[#fff9ef]">
            {/* COMPACT HERO: title + live countdown on one row so designs show above the fold */}
            <header className="relative overflow-hidden bg-gradient-to-br from-[#24170f] to-[#1b100b]">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "radial-gradient(#f1cf8a 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                />
                <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 md:flex-row md:items-center md:justify-between lg:px-8">
                    <div className="min-w-0">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#f1cf8a]/30 bg-[#f1cf8a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.18em] text-[#f1cf8a]">
                            <Sparkles size={12} /> Limited time event
                        </div>
                        <h1 className="serif text-3xl font-bold leading-tight text-white sm:text-4xl">{event.name}</h1>
                        <p className="mt-1 text-sm text-[#d9c9b8] sm:text-base">{B.eventSubtitle}</p>
                    </div>

                    <div className="shrink-0" role="timer" aria-label="Time left in event">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#a88b6f] md:text-right">Event ends in</div>
                        <div className="flex gap-2">
                            {countdown.map(([label, value]) => (
                                <div key={label} className="w-14 rounded-xl border border-[#3a2418] bg-[#24170f]/80 py-2 text-center sm:w-16">
                                    <div className="text-xl font-bold tabular-nums leading-none text-[#f1cf8a] sm:text-2xl">{pad(value)}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-widest text-[#a88b6f]">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-center gap-2 bg-[#f1cf8a] px-5 py-2 text-center text-xs font-bold text-[#24170f] sm:text-sm">
                    <Clock size={15} className="shrink-0" /> First come, first served. Book now to secure your token number.
                </div>
            </header>

            {/* DESIGNS */}
            <section className="bg-[#fbf7f0] text-[#24170f]">
                <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
                    {/* TOOLBAR */}
                    {!loading && !error && designs.length > 0 && (
                        <div className="mb-6">
                            <div className="flex flex-col gap-3 md:flex-row">
                                <label className="relative flex-1">
                                    <span className="sr-only">Search {B.items}</span>
                                    <Search size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#8a6d53]" />
                                    <input
                                        type="search"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search by name, description or category..."
                                        className="w-full rounded-full border border-[#e4d3bd] bg-white py-3 pl-12 pr-11 text-sm text-[#24170f] outline-none transition placeholder:text-[#a88b6f] focus:border-[#7d3f24] focus:ring-2 focus:ring-[#7d3f24]/20 [&::-webkit-search-cancel-button]:hidden"
                                    />
                                    {query && (
                                        <button
                                            type="button"
                                            onClick={() => setQuery("")}
                                            aria-label="Clear search"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8a6d53] hover:bg-[#f3e8d8]"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </label>

                                <div className="flex gap-3">
                                    <label className="relative flex-1 md:flex-none">
                                        <span className="sr-only">Category</span>
                                        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectClass} w-full`}>
                                            <option value="all">All categories</option>
                                            {categories.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8a6d53]" />
                                    </label>

                                    <label className="relative flex-1 md:flex-none">
                                        <span className="sr-only">Sort {B.items}</span>
                                        <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${selectClass} w-full`}>
                                            <option value="newest">Newest first</option>
                                            <option value="oldest">Oldest first</option>
                                            <option value="price-asc">Price: low to high</option>
                                            <option value="price-desc">Price: high to low</option>
                                            <option value="name">Name A-Z</option>
                                        </select>
                                        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8a6d53]" />
                                    </label>
                                </div>
                            </div>

                            {/* Category chips: quick filter on mobile and desktop */}
                            {categories.length > 0 && (
                                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                                    {["all", ...categories].map((c) => {
                                        const active = category === c;
                                        return (
                                            <button
                                                key={c}
                                                onClick={() => setCategory(c)}
                                                aria-pressed={active}
                                                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${active
                                                    ? "border-[#24170f] bg-[#24170f] text-white"
                                                    : "border-[#e4d3bd] bg-white text-[#6b4a35] hover:border-[#7d3f24]"
                                                    }`}
                                            >
                                                {c === "all" ? "All" : c}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-3 flex items-center justify-between text-sm text-[#8a6d53]" aria-live="polite">
                                <span>
                                    Showing {Math.min(visible, filtered.length)} of {filtered.length} event design{filtered.length === 1 ? "" : "s"}
                                </span>
                                {hasFilters && (
                                    <button onClick={clearFilters} className="font-semibold text-[#7d3f24] hover:underline">
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STATES */}
                    {loading && (
                        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[#eadcc9] bg-white">
                                    <div className="aspect-[4/5] bg-[#eadcc9]" />
                                    <div className="space-y-2 p-4">
                                        <div className="h-3 w-1/3 rounded bg-[#eadcc9]" />
                                        <div className="h-4 w-2/3 rounded bg-[#eadcc9]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && error && (
                        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                            <div className="font-semibold text-red-700">Unable to load event {B.items}</div>
                            <div className="mt-2 text-sm text-red-600/80">{error}</div>
                        </div>
                    )}

                    {!loading && !error && designs.length === 0 && (
                        <div className="mx-auto max-w-xl rounded-2xl border border-[#eadcc9] bg-white p-8 text-center">
                            <Sparkles size={30} className="mx-auto mb-3 text-[#b8893b]" />
                            <div className="font-semibold">No {B.items} in this event yet</div>
                            <div className="mt-2 text-sm text-[#8a6d53]">Check back soon. New {B.items} are added during the event.</div>
                        </div>
                    )}

                    {!loading && !error && designs.length > 0 && filtered.length === 0 && (
                        <div className="mx-auto max-w-xl rounded-2xl border border-[#eadcc9] bg-white p-8 text-center">
                            <Search size={28} className="mx-auto mb-3 text-[#b8893b]" />
                            <div className="font-semibold">No {B.items} match your search</div>
                            <div className="mt-2 text-sm text-[#8a6d53]">Try a different word or choose another category.</div>
                            <button onClick={clearFilters} className="mt-4 rounded-full bg-[#24170f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#382419]">
                                Clear filters
                            </button>
                        </div>
                    )}

                    {/* GRID */}
                    {!loading && !error && filtered.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {filtered.slice(0, visible).map((design) => {
                                    const onSale = design.originalPrice != null && design.price !== design.originalPrice;
                                    const cat = getCategory(design);
                                    return (
                                        <article
                                            key={design.id}
                                            className="group flex flex-col overflow-hidden rounded-2xl border border-[#eadcc9] bg-white shadow-sm transition hover:shadow-xl"
                                        >
                                            <button
                                                onClick={() => onSelect(design)}
                                                className="relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-[#eadcc9] text-left"
                                                aria-label={`View ${design.name}`}
                                            >
                                                <SafeImage
                                                    src={imageUrl(design.image)}
                                                    alt={design.name}
                                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                />
                                                {onSale && (
                                                    <span className="absolute left-3 top-3 rounded-full bg-[#7d3f24] px-3 py-1 text-xs font-bold text-white shadow">
                                                        Event price
                                                    </span>
                                                )}
                                            </button>

                                            <div className="flex flex-1 flex-col p-4">
                                                {cat && (
                                                    <div className="mb-1 flex items-center gap-1 text-xs font-medium text-[#8a6d53]">
                                                        <Tag size={12} /> {cat}
                                                    </div>
                                                )}
                                                <h3 className="serif line-clamp-1 text-lg font-semibold">{design.name}</h3>

                                                <div className="mt-1 flex items-baseline gap-2">
                                                    <span className="text-lg font-bold text-[#7d3f24]">{currency(design.price)}</span>
                                                    {onSale && (
                                                        <span className="text-sm text-[#a88b6f] line-through">{currency(design.originalPrice)}</span>
                                                    )}
                                                </div>

                                                <button
                                                    // eventId lets the backend generate a token for this order
                                                    onClick={() => onAddToCart({ ...design, eventId: event.id })}
                                                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#24170f] py-2.5 text-sm font-semibold text-white transition hover:bg-[#382419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7d3f24]"
                                                >
                                                    <ShoppingBag size={16} /> Add to selection
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            {visible < filtered.length && (
                                <div className="mt-10 text-center">
                                    <button
                                        onClick={() => setVisible((v) => v + PAGE_SIZE)}
                                        className="rounded-full border border-[#24170f] px-8 py-3 text-sm font-semibold text-[#24170f] transition hover:bg-[#24170f] hover:text-white"
                                    >
                                        Show more designs
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}