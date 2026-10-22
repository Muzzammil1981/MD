import { useEffect, useMemo, useState } from "react";
import {
    X, Minus, Plus, Trash2, Loader2, Search, AlertCircle, CheckCircle2,
    ArrowRight, Sparkles, Image as ImageIcon,
} from "lucide-react";
import { api } from "../lib/api";
import { imageUrl, currency } from "../lib/format";
import SafeImage from "../components/SafeImage";
import { B } from "../lib/brand";

export default function ModifyOrderModal({ order, activeEvent, onClose, onSuccess }) {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Current items in the order — start from what's already there
    const [items, setItems] = useState(() =>
        Array.isArray(order.items) ? order.items.map(it => ({ ...it })) : []
    );

    const [categoryFilter, setCategoryFilter] = useState("all");
    const [search, setSearch] = useState("");

    /* ---------- Load the right catalog ---------- */
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");

        const eventId = order.eventId || activeEvent?.id;

        const loadCatalog = async () => {
            try {
                const { data } = await api.get("/api/designs");
                let list = Array.isArray(data) ? data : [];

                if (eventId) {
                    // Event order: filter to the event's designs & apply price overrides
                    try {
                        const { data: evRes } = await api.get(`/api/events/${eventId}`);
                        const ev = evRes?.event;
                        const overrides = ev?.priceOverrides || {};
                        const ids = Array.isArray(ev?.designIds) ? ev.designIds : [];

                        if (ids.length > 0 && !ids.includes("all")) {
                            list = list.filter(d => ids.includes(d.id));
                        }
                        list = list.map(d => ({
                            ...d,
                            price: overrides[d.id] != null ? Number(overrides[d.id]) : d.price,
                        }));
                    } catch (e) {
                        console.warn("[ModifyOrderModal] failed to load event, falling back to full catalog:", e?.message);
                    }
                }

                if (!cancelled) setCatalog(list);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || `Could not load ${B.items}`);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadCatalog();
        return () => { cancelled = true; };
    }, [order.eventId, activeEvent?.id]);

    /* ---------- Derived ---------- */
    const categories = useMemo(() => {
        const map = new Map();
        catalog.forEach(d => {
            if (d.categoryId && d.categoryName) map.set(d.categoryId, d.categoryName);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [catalog]);

    const filteredCatalog = useMemo(() => {
        let list = catalog;
        if (categoryFilter !== "all") list = list.filter(d => d.categoryId === categoryFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(d =>
                d.name?.toLowerCase().includes(q) ||
                d.categoryName?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [catalog, categoryFilter, search]);

    const newTotal = items.reduce((n, x) => n + (x.price || 0) * (x.qty || 1), 0);
    const previousTotal = order.total || 0;
    const diff = newTotal - previousTotal;
    const diffLabel =
        Math.abs(diff) < 0.01 ? "No price change"
            : diff > 0 ? `+ ${currency(diff)} to pay`
                : `${currency(Math.abs(diff))} refund / credit`;

    const isItemInCart = (designId) => items.some(i => i.id === designId);

    /* ---------- Actions ---------- */
    const addDesign = (design) => {
        setItems(prev => {
            const found = prev.find(x => x.id === design.id);
            if (found) {
                return prev.map(x => x.id === design.id ? { ...x, qty: (x.qty || 1) + 1 } : x);
            }
            return [
                ...prev,
                {
                    id: design.id,
                    name: design.name,
                    price: design.price,
                    image: design.image,
                    categoryName: design.categoryName,
                    amountType: design.amountType,
                    qty: 1,
                },
            ];
        });
    };

    const removeItem = (id) => setItems(prev => prev.filter(x => x.id !== id));

    const changeQty = (id, delta) =>
        setItems(prev => prev.map(x =>
            x.id === id ? { ...x, qty: Math.max(1, (x.qty || 1) + delta) } : x
        ));

    const save = async () => {
        if (items.length === 0) return setError(`Order must contain at least one ${B.item}`);
        setSaving(true);
        setError("");
        try {
            const cleanItems = items.map(({ id, name, price, qty, image, categoryName, amountType }) => ({
                id, name, price, qty, image, categoryName, amountType,
            }));
            const { data } = await api.patch(`/api/orders/${order.id}/items`, { items: cleanItems });
            onSuccess?.(data);
        } catch (err) {
            setError(err.response?.data?.message || "Could not save your changes");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#20140e]/75 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()}
                className="flex h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:h-[92vh] sm:rounded-[28px]">

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eadfce] bg-[#faf5ed] px-4 py-3.5 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[.2em] text-[#8a6d53] sm:tracking-[.24em]">
                            {order.eventId ? "Modify event order" : "Modify order"}
                        </div>
                        <div className="serif truncate text-xl font-semibold sm:text-2xl">
                            Order #{order.id.slice(0, 8)}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-[#f1e6d8] active:bg-[#eadfce]">
                        <X size={18} />
                    </button>
                </div>

                {/* Body — two columns on desktop */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="grid gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">

                        {/* LEFT: catalog picker */}
                        <div className="min-w-0 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a38974]" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder={`Search ${B.items}…`}
                                        className="w-full rounded-xl border border-[#ddcdb8] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                    />
                                </div>
                            </div>

                            {categories.length > 0 && (
                                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                                    <button
                                        onClick={() => setCategoryFilter("all")}
                                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${categoryFilter === "all"
                                            ? "border-[#24170f] bg-[#24170f] text-white"
                                            : "border-[#ded0bc] bg-white text-[#5b4636] hover:bg-[#f4eadc]"}`}
                                    >
                                        All
                                    </button>
                                    {categories.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setCategoryFilter(c.id)}
                                            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${categoryFilter === c.id
                                                ? "border-[#7d3f24] bg-[#7d3f24] text-white"
                                                : "border-[#ded0bc] bg-white text-[#5b4636] hover:bg-[#f4eadc]"}`}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {loading ? (
                                <div className="grid h-40 place-items-center text-[#8a6d53]">
                                    <Loader2 className="animate-spin" />
                                </div>
                            ) : filteredCatalog.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#d9c7b0] bg-white p-8 text-center text-sm text-[#8a6d53]">
                                    No designs match this filter.
                                </div>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                                    {filteredCatalog.map(d => {
                                        const inCart = isItemInCart(d.id);
                                        return (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => addDesign(d)}
                                                className={`flex items-center gap-3 rounded-2xl border bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${inCart ? "border-[#7d3f24]" : "border-[#eadfce]"}`}
                                            >
                                                <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-[#eadcc9]">
                                                    {d.image ? (
                                                        <SafeImage src={imageUrl(d.image, "thumb")} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="grid h-full w-full place-items-center text-[#a38974]"><ImageIcon size={14} /></div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-semibold">{d.name}</div>
                                                    <div className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-[#8a6d53]">
                                                        {d.categoryName || "—"}
                                                    </div>
                                                    <div className="mt-1 text-xs font-bold text-[#7d3f24]">{currency(d.price)}</div>
                                                </div>
                                                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${inCart ? "bg-[#7d3f24] text-white" : "bg-[#f4eadc] text-[#7d3f24]"}`}>
                                                    {inCart ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: current items + totals */}
                        <div className="min-w-0 space-y-3 md:sticky md:top-0 md:h-fit">
                            <div className="rounded-2xl border border-[#f1cf8a] bg-[#fdf9ef] p-3">
                                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#7d3f24]">
                                    <span>Your order ({items.length})</span>
                                    <span>{currency(newTotal)}</span>
                                </div>

                                {items.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[#d9c7b0] bg-white p-4 text-center text-xs text-[#8a6d53]">
                                        Add at least one design
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {items.map(it => (
                                            <div key={it.id} className="flex items-center gap-2 rounded-xl border border-[#eadfce] bg-white p-2">
                                                <div className="h-12 w-10 shrink-0 overflow-hidden rounded-md bg-[#eadcc9]">
                                                    {it.image && (
                                                        <SafeImage src={imageUrl(it.image, "thumb")} alt="" className="h-full w-full object-cover" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-xs font-semibold">{it.name}</div>
                                                    <div className="mt-0.5 text-[10px] text-[#8a6d53]">{currency(it.price)} each</div>
                                                    <div className="mt-1 flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => changeQty(it.id, -1)}
                                                            className="rounded-full border border-[#ded0bc] p-1 hover:bg-[#f4eadc]"
                                                            aria-label="Decrease"
                                                        >
                                                            <Minus size={10} />
                                                        </button>
                                                        <span className="w-5 text-center text-[11px] font-bold">{it.qty || 1}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => changeQty(it.id, 1)}
                                                            className="rounded-full border border-[#ded0bc] p-1 hover:bg-[#f4eadc]"
                                                            aria-label="Increase"
                                                        >
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(it.id)}
                                                    className="shrink-0 rounded-full p-1.5 text-[#a17e63] hover:bg-red-50 hover:text-red-500"
                                                    aria-label="Remove"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Price diff */}
                            <div className="rounded-2xl border border-[#eadfce] bg-white p-3 text-xs">
                                <div className="flex justify-between text-[#8a6d53]">
                                    <span>Previous total</span>
                                    <span className="font-semibold text-[#5b4636]">{currency(previousTotal)}</span>
                                </div>
                                <div className="mt-1 flex justify-between text-[#8a6d53]">
                                    <span>New total</span>
                                    <span className="font-semibold text-[#5b4636]">{currency(newTotal)}</span>
                                </div>
                                <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold ${Math.abs(diff) < 0.01
                                    ? "bg-[#f4eadc] text-[#8a6d53]"
                                    : diff > 0
                                        ? "bg-[#fdf3d6] text-[#8a6d1c]"
                                        : "bg-[#e2f0e5] text-[#1d7a3e]"}`}>
                                    <span>Difference</span>
                                    <span>{diffLabel}</span>
                                </div>
                                {Math.abs(diff) > 0.01 && (
                                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-[#f5ecdf] px-3 py-2 text-[10px] text-[#5b4636]">
                                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                        <span>
                                            {diff > 0
                                                ? "You'll be asked to pay the difference after saving."
                                                : "Your payment will be adjusted down. Studio will handle any credit."}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-xl bg-[#f8e4df] px-3 py-2 text-xs text-[#8c392d]">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="shrink-0 border-t border-[#eadfce] bg-[#fffdf9] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="w-full rounded-full border border-[#ded0bc] bg-white px-5 py-3 text-sm font-semibold text-[#5b4636] hover:bg-[#f4eadc] disabled:opacity-60 sm:w-auto"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || items.length === 0}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
                        >
                            {saving ? (
                                <><Loader2 size={15} className="animate-spin" /> Saving…</>
                            ) : (
                                <>Save changes <ArrowRight size={15} /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}