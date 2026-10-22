import { useEffect, useState } from "react";
import {
    X, Calendar, Clock, Loader2, CheckCircle2, XCircle, Hourglass, CreditCard,
    ShieldAlert, AlertCircle, Maximize2, Sparkles, PartyPopper, Lock, Wallet, RefreshCw,
    Pencil, Palette, Coins, Users, Star,
} from "lucide-react";
import { api } from "../lib/api";
import ReviewModal from "./ReviewModal";
import { Stars } from "../components/Stars";
import { imageUrl, currency } from "../lib/format";
import { B } from "../lib/brand";

function formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const STATUS_STYLES = {
    pending: { icon: <Hourglass size={13} />, label: "Pending approval", cls: "bg-[#fdf3d6] text-[#8a6d1c]" },
    approved: { icon: <CheckCircle2 size={13} />, label: "Awaiting payment", cls: "bg-[#e2f0e5] text-[#1d7a3e]" },
    "awaiting-verification": { icon: <ShieldAlert size={13} />, label: "Pending verification", cls: "bg-[#fdf3d6] text-[#8a6d1c]" },
    rejected: { icon: <XCircle size={13} />, label: "Rejected", cls: "bg-[#f8e4df] text-[#8c392d]" },
    paid: { icon: <CheckCircle2 size={13} />, label: "Paid ✓", cls: "bg-[#e2f0e5] text-[#1d7a3e]" },
    "in-progress": { icon: <Sparkles size={13} />, label: "In progress 🎨", cls: "bg-[#fdf3d6] text-[#8a6d1c]" },
    completed: { icon: <CheckCircle2 size={13} />, label: "Ready ✓", cls: "bg-[#e2f0e5] text-[#1d7a3e]" },
    "custom-pending": { icon: <Palette size={13} />, label: "Awaiting studio quote", cls: "bg-[#fdf9ef] text-[#7d3f24] border border-[#f1cf8a]" },
    "quote-proposed": { icon: <Coins size={13} />, label: "Counter-offer received", cls: "bg-[#fdf3d6] text-[#8a6d1c]" },
};

const PAYMENT_BADGE = {
    upi: { label: "📱 UPI", cls: "border-[#1d7a3e]/30 bg-[#e2f0e5] text-[#1d7a3e]" },
    card: { label: "💳 Card", cls: "border-[#2a3a7d]/30 bg-[#e6e8f7] text-[#2a3a7d]" },
    cash: { label: "💵 Cash", cls: "border-[#8a6d1c]/30 bg-[#fdf3d6] text-[#8a6d1c]" },
};

export default function MyOrdersModal({ onClose, onPay, onModify }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lightbox, setLightbox] = useState(null);
    const [responding, setResponding] = useState(null);
    const [reviews, setReviews] = useState({});          // orderId -> my review
    const [reviewing, setReviewing] = useState(null);    // order being reviewed

    const load = (silent = false) => {
        if (!silent) setLoading(true);
        setError("");
        api.get(`/api/orders?t=${Date.now()}`)
            .then(({ data }) => setOrders(Array.isArray(data) ? data : []))
            .catch((err) => setError(err.response?.data?.message || "Could not load orders"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        api.get("/api/reviews/mine")
            .then(({ data }) => setReviews(Object.fromEntries((data || []).map((r) => [r.orderId, r]))))
            .catch(() => { });
    }, []);
    useEffect(() => {
        const handler = () => load(true);
        window.addEventListener("mehndi:order-update", handler);
        return () => window.removeEventListener("mehndi:order-update", handler);
    }, []);

    useEffect(() => {
        if (!lightbox) return;
        const handler = (e) => { if (e.key === "Escape") setLightbox(null); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [lightbox]);

    const respondToQuote = async (orderId, action) => {
        setResponding(orderId);
        try {
            await api.patch(`/api/orders/${orderId}/quote-response`, { action });
            load(true);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to respond");
        } finally {
            setResponding(null);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[75] flex items-end justify-center bg-[#20140e]/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
                <div onMouseDown={e => e.stopPropagation()} className="flex h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:h-[90vh] sm:rounded-[28px]">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eadfce] bg-[#faf5ed] px-4 py-3.5 sm:px-6 sm:py-4">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[.2em] text-[#8a6d53] sm:tracking-[.24em]">Appointments</div>
                            <div className="serif truncate text-xl font-semibold sm:text-2xl">My orders</div>
                        </div>
                        <button onClick={onClose} aria-label="Close orders" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-[#f1e6d8] active:bg-[#eadfce]"><X size={18} /></button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5">
                        {error && <div className="mb-4 rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                        {loading ? (
                            <div className="grid h-full place-items-center text-[#8a6d53]"><Loader2 className="animate-spin" /></div>
                        ) : orders.length === 0 ? (
                            <div className="grid h-full place-items-center text-center text-[#8a6d53]">
                                <div className="max-w-xs">
                                    <Calendar className="mx-auto" size={34} />
                                    <p className="serif mt-4 text-lg sm:text-xl">No appointments yet</p>
                                    <p className="mt-1 text-xs sm:text-sm">Add {B.items} to your cart and request a slot.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-3.5 sm:gap-4">
                                {orders.map(o => {
                                    const S = STATUS_STYLES[o.status] || STATUS_STYLES.pending;
                                    const d = o.proposedDate || o.requestedDate;
                                    const t = o.proposedTime || o.requestedTime;
                                    const isPending = o.status === "pending";
                                    const isAwaiting = o.status === "awaiting-verification";
                                    const isApproved = o.status === "approved";
                                    const isPaid = o.status === "paid";
                                    const isInProgress = o.status === "in-progress";
                                    const isCompleted = o.status === "completed";
                                    const isCustom = o.type === "custom";
                                    const isQuoteProposed = o.status === "quote-proposed";
                                    const isCustomPending = o.status === "custom-pending";
                                    const blurThumb = isPending || isAwaiting || isCustomPending || isQuoteProposed;

                                    const isCounterPayment = ["cash", "card"].includes(o.paymentMethod);
                                    const payBadge = PAYMENT_BADGE[o.paymentMethod];

                                    const canModify = !isCustom && !o.isGroup && ["pending", "approved", "awaiting-verification", "paid"].includes(o.status);
                                    const isResponding = responding === o.id;

                                    // NEW: money fields
                                    const totalDue = Number(o.total) || 0;
                                    const paidAmount = Number(o.paidAmount) || 0;
                                    const balanceDue = Number(o.balanceDue) || 0;
                                    const refundDue = Number(o.refundDue) || 0;
                                    const amountToPayNow = balanceDue > 0 ? balanceDue : totalDue;

                                    return (
                                        <div key={o.id} className={`rounded-2xl border bg-white p-3.5 sm:p-4 ${isCustom && (isCustomPending || isQuoteProposed) ? "border-2 border-[#f1cf8a]" : "border-[#eadfce]"}`}>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                                <div className="min-w-0">
                                                    <div className="truncate text-[10px] uppercase tracking-[.16em] text-[#8a6d53] sm:tracking-[.18em]">Order #{o.id.slice(0, 8)}</div>

                                                    {o.tokenNumber && !o.isGroup && (
                                                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f1cf8a]/30 border border-[#f1cf8a]/50 px-2.5 py-0.5 text-[11px] font-bold text-[#7d3f24]">
                                                            🎟️ {o.eventName ? `${o.eventName} - ` : ""}Token #{o.tokenNumber}
                                                        </div>
                                                    )}

                                                    {payBadge && (
                                                        <span className={`ml-2 mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${payBadge.cls}`}>
                                                            {payBadge.label}
                                                        </span>
                                                    )}

                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                                                        <span className="inline-flex items-center gap-1.5"><Calendar size={13} className="text-[#7d3f24]" /> {d}</span>
                                                        <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-[#7d3f24]" /> {t}</span>
                                                        {o.proposedDate && o.proposedDate !== o.requestedDate && <span className="rounded-full bg-[#f4eadc] px-2 py-0.5 text-[10px]">rescheduled</span>}
                                                    </div>
                                                </div>
                                                <span className={`inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-xs ${S.cls}`}>{S.icon} {S.label}</span>
                                            </div>

                                            {/* Group order — member tokens with their designs */}
                                            {o.isGroup && o.members?.length > 0 && (
                                                <div className="mt-3 rounded-2xl border border-[#f1cf8a] bg-[#fdf9ef] p-4">
                                                    <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#7d3f24]">
                                                        <span><Users size={12} className="mr-1 inline" /> Group of {o.members.length}</span>
                                                        <span>{currency(o.total)} total</span>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        {o.members.map(m => {
                                                            const mStatus = m.status || "pending";
                                                            const memberItems = Array.isArray(m.items) ? m.items : [];
                                                            return (
                                                                <div key={m.memberId} className="rounded-xl border border-[#eadfce] bg-white p-3">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                                                            {m.tokenNumber ? (
                                                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f1cf8a]/40 border border-[#f1cf8a]/60 px-2.5 py-0.5 text-[11px] font-bold text-[#7d3f24]">
                                                                                    🎟️ #{m.tokenNumber}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex shrink-0 items-center rounded-full bg-[#f4eadc] px-2.5 py-0.5 text-[10px] font-semibold text-[#8a6d53]">
                                                                                    Awaiting
                                                                                </span>
                                                                            )}
                                                                            <span className="truncate text-sm font-semibold">{m.name}</span>
                                                                            {mStatus === "in-progress" && <MemberInlineTimer startedAt={m.startedAt} />}
                                                                            {mStatus === "completed" && (
                                                                                <span className="shrink-0 rounded-full bg-[#e2f0e5] px-2 py-0.5 text-[10px] font-bold text-[#1d7a3e]">
                                                                                    ✓ Done {formatDuration(m.durationSeconds)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="shrink-0 text-xs font-semibold text-[#7d3f24]">{currency(m.subtotal)}</span>
                                                                    </div>

                                                                    {memberItems.length > 0 && (
                                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                                            {memberItems.map((it, idx) =>
                                                                                blurThumb ? (
                                                                                    <div key={idx} title="Revealed after studio confirms" className="grid h-14 w-12 place-items-center overflow-hidden rounded-lg border border-[#e6d3bd] bg-gradient-to-br from-[#f3e6d5] via-[#ead7bf] to-[#dcc3a3] sm:h-16 sm:w-14">
                                                                                        <Lock size={12} className="text-[#7d3f24]" />
                                                                                    </div>
                                                                                ) : (
                                                                                    <button
                                                                                        key={idx}
                                                                                        type="button"
                                                                                        onClick={() => setLightbox({ src: imageUrl(it.image), alt: it.name })}
                                                                                        className="group relative h-14 w-12 cursor-zoom-in overflow-hidden rounded-lg border border-[#eadfce] bg-[#eadcc9] transition hover:ring-2 hover:ring-[#7d3f24] sm:h-16 sm:w-14"
                                                                                        title={`${it.qty}× ${it.name}`}
                                                                                    >
                                                                                        <img src={imageUrl(it.image, "thumb")} alt={it.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                                                                    </button>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {memberItems.length > 0 && !blurThumb && (
                                                                        <div className="mt-1.5 space-y-0.5 text-[10px] text-[#8a6d53]">
                                                                            {memberItems.map((it, idx) => (
                                                                                <div key={idx} className="truncate">{it.qty}× {it.name}</div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Custom order block */}
                                            {isCustom ? (
                                                <div className="mt-3 rounded-2xl border-2 border-dashed border-[#f1cf8a] bg-[#fdf9ef] p-4">
                                                    <div className="flex items-start gap-3">
                                                        {o.customImage && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setLightbox({ src: imageUrl(o.customImage), alt: "Your reference" })}
                                                                className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[#eadfce] bg-white transition hover:ring-2 hover:ring-[#7d3f24]"
                                                            >
                                                                <img src={imageUrl(o.customImage)} alt="Reference" className="h-full w-full object-cover" />
                                                            </button>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7d3f24]">🎨 {B.CustomRequest}</div>
                                                            <div className="mt-1 line-clamp-3 text-xs text-[#5b4636] whitespace-pre-wrap">{o.customDescription}</div>
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                <span className="rounded-full bg-[#f1cf8a]/40 px-2.5 py-0.5 text-[10px] font-bold text-[#7d3f24]">
                                                                    Your price: {currency(o.suggestedPrice)}
                                                                </span>
                                                                {o.quotedPrice && (
                                                                    <span className="rounded-full bg-[#fdf3d6] px-2.5 py-0.5 text-[10px] font-bold text-[#8a6d1c]">
                                                                        Studio: {currency(o.quotedPrice)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : o.isGroup ? null : (
                                                <div className="mt-3 flex flex-wrap gap-2.5 sm:mt-4 sm:gap-3">
                                                    {o.items.map((it, idx) =>
                                                        blurThumb ? (
                                                            <div key={idx} title="Revealed after studio confirms" className="relative grid h-24 w-20 place-items-center overflow-hidden rounded-xl border border-[#e6d3bd] bg-gradient-to-br from-[#f3e6d5] via-[#ead7bf] to-[#dcc3a3] sm:h-32 sm:w-28 sm:rounded-2xl">
                                                                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#9b6d43 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
                                                                <div className="relative flex flex-col items-center gap-1.5 px-1 text-center">
                                                                    <div className="grid h-9 w-9 place-items-center rounded-full bg-white/85 shadow sm:h-10 sm:w-10">
                                                                        {isPending ? <Lock size={16} className="text-[#7d3f24]" /> : <ShieldAlert size={16} className="text-[#8a6d1c]" />}
                                                                    </div>
                                                                    <span className="line-clamp-2 text-[9px] font-semibold leading-tight text-[#7d3f24] sm:text-[10px]">{it.name}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button key={idx} type="button" onClick={() => setLightbox({ src: imageUrl(it.image), alt: it.name })} className="group relative h-24 w-20 cursor-zoom-in overflow-hidden rounded-xl border border-[#eadfce] bg-[#eadcc9] transition hover:ring-2 hover:ring-[#7d3f24] sm:h-32 sm:w-28 sm:rounded-2xl" title={`Click to view ${it.name}`}>
                                                                <img src={imageUrl(it.image)} alt={it.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                                                <div className="absolute inset-0 hidden flex-col items-center justify-end bg-gradient-to-t from-black/70 to-transparent pb-2 opacity-0 transition group-hover:opacity-100 sm:flex">
                                                                    <Maximize2 size={14} className="text-white" />
                                                                    <span className="mt-0.5 text-[10px] font-semibold text-white">Enlarge</span>
                                                                </div>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}

                                            {isPending && !isCustom && (
                                                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0d9b5] bg-[#fff6e6] px-3 py-2.5 text-[11px] font-semibold leading-5 text-[#8a5a1c]">
                                                    <Hourglass size={14} className="mt-0.5 shrink-0" />
                                                    <span>Awaiting admin approval — {B.items} revealed once confirmed.</span>
                                                </div>
                                            )}

                                            {isCustomPending && (
                                                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0d9b5] bg-[#fff6e6] px-3 py-2.5 text-[11px] font-semibold leading-5 text-[#8a5a1c]">
                                                    <Palette size={14} className="mt-0.5 shrink-0" />
                                                    <span>Waiting for the studio to review your {B.custom} and respond to your price.</span>
                                                </div>
                                            )}

                                            {isQuoteProposed && (
                                                <div className="mt-3 rounded-2xl border border-[#f0d98c] bg-gradient-to-br from-[#fdf3d6] to-[#fff8e5] px-4 py-3">
                                                    <div className="text-sm font-bold text-[#8a6d1c]">
                                                        Studio proposed <span className="serif text-xl">{currency(o.quotedPrice)}</span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-[#8a6d1c]">
                                                        {o.adminNote || "Review and accept to continue, or decline if you'd like a different price."}
                                                    </div>
                                                </div>
                                            )}

                                            {isAwaiting && (
                                                <div className="mt-3 break-words rounded-xl bg-[#fdf3d6] px-3 py-2 text-[11px] font-semibold text-[#8a6d1c]">Payment submitted (UTR: <span className="font-mono">{o.utr}</span>). Awaiting studio verification.</div>
                                            )}

                                            {isInProgress && !o.isGroup && <LiveTimer startedAt={o.startedAt} />}

                                            {isInProgress && o.isGroup && (
                                                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#f0d98c] bg-gradient-to-br from-[#fdf3d6] to-[#fff8e5] px-3 py-2.5 sm:px-4 sm:py-3">
                                                    <span className="relative flex h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8a6d1c] opacity-60" /><span className="relative inline-flex h-full w-full rounded-full bg-[#8a6d1c]" /></span>
                                                    <div className="min-w-0 flex-1 text-[11px] text-[#8a6d1c] sm:text-xs">
                                                        Studio is working through your group — each member's token shows their status above.
                                                    </div>
                                                </div>
                                            )}

                                            {isCompleted && (
                                                <div className="mt-3 overflow-hidden rounded-2xl border border-[#c8e6d2] bg-gradient-to-br from-[#eaf7ee] via-[#f4fbf6] to-[#f8fdf9] p-4 sm:p-5">
                                                    <div className="flex items-start gap-3 sm:gap-4">
                                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1d7a3e] text-white shadow-lg shadow-[#1d7a3e]/30 sm:h-12 sm:w-12">
                                                            <CheckCircle2 size={20} className="sm:hidden" /><CheckCircle2 size={24} className="hidden sm:block" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="serif text-lg font-semibold text-[#1d7a3e] sm:text-xl">
                                                                {o.isGroup ? B.readyGroup : B.readyTitle}
                                                            </div>
                                                            <p className="mt-1.5 text-xs leading-5 text-[#3d5c47] sm:text-sm sm:leading-6">
                                                                Thank you for choosing <strong>{B.name}</strong> — it was a joy creating this for you
                                                                {!o.isGroup && o.durationSeconds ? <> Total time: <strong>{formatDuration(o.durationSeconds)}</strong>.</> : null}
                                                            </p>
                                                            <p className="mt-2 flex items-center gap-1.5 text-[11px] italic text-[#4a7a5c] sm:text-xs"><PartyPopper size={12} className="shrink-0" />We can't wait to welcome you back. ✨</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Items list — single orders only */}
                                            {!isCustom && !o.isGroup && (
                                                <div className="mt-3 grid gap-1 border-t border-[#f0e6d8] pt-3 text-xs sm:mt-4 sm:text-sm">
                                                    {o.items.map((it, idx) => (
                                                        <div key={idx} className="flex justify-between gap-3 text-[#715e4e]"><span className="min-w-0 truncate">{it.qty}× {it.name}</span><span className="shrink-0">{currency(it.price * it.qty)}</span></div>
                                                    ))}
                                                    <div className="mt-2 flex justify-between font-semibold"><span>Total</span><span>{currency(totalDue)}</span></div>

                                                    {/* NEW: show already-paid and balance */}
                                                    {paidAmount > 0 && balanceDue > 0 && (
                                                        <>
                                                            <div className="flex justify-between text-[11px] text-[#1d7a3e]">
                                                                <span>Already paid</span>
                                                                <span>− {currency(paidAmount)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px] font-bold text-[#7d3f24]">
                                                                <span>Balance due</span>
                                                                <span>{currency(balanceDue)}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {refundDue > 0 && (
                                                        <div className="flex justify-between text-[11px] font-bold text-[#9b3b2b]">
                                                            <span>Refund due to you</span>
                                                            <span>{currency(refundDue)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {isCustom && o.total > 0 && (
                                                <div className="mt-3 grid gap-1 border-t border-[#f0e6d8] pt-3 text-xs sm:text-sm">
                                                    <div className="flex justify-between font-semibold"><span>Total</span><span>{currency(o.total)}</span></div>
                                                </div>
                                            )}

                                            {o.paymentRejectReason && (
                                                <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f8e4df] px-3 py-2 text-xs text-[#8c392d]">
                                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                    <div className="min-w-0 break-words"><strong>Payment not received:</strong> {o.paymentRejectReason}</div>
                                                </div>
                                            )}

                                            {o.adminNote && !isQuoteProposed && (
                                                <div className="mt-3 break-words rounded-xl bg-[#f5ecdf] px-3 py-2 text-xs text-[#5b4636]">
                                                    <strong>Studio note:</strong> {o.adminNote}
                                                </div>
                                            )}

                                            {canModify && (
                                                <button
                                                    onClick={() => onModify?.(o)}
                                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2.5 text-xs font-semibold text-[#5b4636] transition hover:bg-[#f4eadc]"
                                                >
                                                    <Pencil size={13} /> Modify {B.item}
                                                </button>
                                            )}

                                            {isCompleted && (
                                                reviews[o.id] ? (
                                                    <button
                                                        onClick={() => setReviewing(o)}
                                                        className="mt-3 flex w-full items-center justify-between gap-2 rounded-full border border-[#ecd9b4] bg-[#fbf3e1] px-4 py-2.5 text-xs font-semibold text-[#7d3f24] transition hover:bg-[#f6e9cc]"
                                                    >
                                                        <span className="flex items-center gap-2">Your review <Stars value={reviews[o.id].rating} size={13} /></span>
                                                        <span className="underline">Edit</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setReviewing(o)}
                                                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#382419]"
                                                    >
                                                        <Star size={15} className="fill-[#f1cf8a] text-[#f1cf8a]" /> Rate your experience
                                                    </button>
                                                )
                                            )}

                                            {isQuoteProposed && (
                                                <div className="mt-4">
                                                    <div className="flex flex-col gap-2 sm:flex-row">
                                                        <button
                                                            onClick={() => respondToQuote(o.id, "accept")}
                                                            disabled={isResponding}
                                                            className="flex-1 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#1d7a3e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#155c2d] disabled:opacity-60"
                                                        >
                                                            {isResponding ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                                            Accept {currency(o.quotedPrice)}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (!confirm("Decline this counter-offer? Studio will send a new price.")) return;
                                                                respondToQuote(o.id, "decline");
                                                            }}
                                                            disabled={isResponding}
                                                            className="flex-1 flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#e6c4be] bg-white px-5 py-3 text-sm font-semibold text-[#9b3b2b] hover:bg-[#fdf2ef] disabled:opacity-60"
                                                        >
                                                            <XCircle size={15} /> Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* UPI Pay now — shows only the OUTSTANDING balance */}
                                            {isApproved && !isCounterPayment && (
                                                <button onClick={() => onPay(o)} className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                                                    <CreditCard size={15} /> Pay now {currency(amountToPayNow)}
                                                </button>
                                            )}

                                            {/* Cash/card at counter — shows balance */}
                                            {isApproved && isCounterPayment && (
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-start gap-3 rounded-2xl border border-[#f0d98c] bg-gradient-to-br from-[#fdf3d6] to-[#fff8e5] px-4 py-3">
                                                        <Wallet size={20} className="mt-0.5 shrink-0 text-[#8a6d1c]" />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-bold text-[#8a6d1c]">
                                                                Pay {currency(amountToPayNow)} at counter by {o.paymentMethod === "cash" ? "cash" : "card"}
                                                            </div>
                                                            <div className="mt-0.5 text-xs text-[#8a6d1c]/80">
                                                                Show order <strong className="font-mono">#{o.id.slice(0, 8)}</strong> at the studio.
                                                                {paidAmount > 0
                                                                    ? <> You've already paid <strong>{currency(paidAmount)}</strong>; the remaining balance is <strong>{currency(balanceDue)}</strong>.</>
                                                                    : " Your token will be assigned once payment is received."}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button onClick={() => onPay(o)} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2.5 text-xs font-semibold text-[#5b4636] transition hover:bg-[#f4eadc]">
                                                        <RefreshCw size={13} /> Change to UPI / Pay online instead
                                                    </button>
                                                </div>
                                            )}

                                            {isPaid && (
                                                <div className="mt-4 flex items-center gap-2 rounded-full bg-[#e2f0e5] px-4 py-2 text-[11px] font-semibold text-[#1d7a3e] sm:text-xs">
                                                    <CheckCircle2 size={14} className="shrink-0" />
                                                    <span className="min-w-0 truncate">
                                                        {refundDue > 0
                                                            ? `Paid ${currency(paidAmount)} · ${currency(refundDue)} refund will be issued by the studio`
                                                            : <>Payment received{o.paymentId ? ` · ${o.paymentId}` : ""}{o.isGroup ? ` · ${o.members.length} tokens assigned` : ""}</>}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {lightbox && (
                <div className="fixed inset-0 z-[95] grid place-items-center bg-black/90 p-3 backdrop-blur-md sm:p-4" onMouseDown={() => setLightbox(null)}>
                    <div onMouseDown={e => e.stopPropagation()} className="relative flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#24170f] shadow-2xl sm:rounded-3xl">
                        <button onClick={() => setLightbox(null)} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black/90 sm:right-4 sm:top-4 sm:h-11 sm:w-11" title="Close (Esc)" aria-label="Close"><X size={20} className="sm:hidden" /><X size={22} className="hidden sm:block" /></button>
                        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-black/40 p-3 sm:p-4">
                            <img src={lightbox.src} alt={lightbox.alt} className="max-h-[72dvh] w-auto max-w-full rounded-xl object-contain shadow-2xl sm:max-h-[80vh] sm:rounded-2xl" />
                        </div>
                        <div className="shrink-0 border-t border-white/10 bg-[#24170f] px-4 py-3 text-center sm:px-6 sm:py-4">
                            <div className="text-[10px] uppercase tracking-[.2em] text-[#8a6d53] sm:tracking-[.24em]">{B.Item}</div>
                            <div className="serif mt-1 truncate text-base font-semibold text-[#f1cf8a] sm:text-xl">{lightbox.alt}</div>
                        </div>
                    </div>
                </div>
            )}
        {reviewing && (
            <ReviewModal
                order={reviewing}
                existing={reviews[reviewing.id]}
                onClose={() => setReviewing(null)}
                onSaved={(r) => { setReviews((m) => ({ ...m, [reviewing.id]: { ...r, orderId: reviewing.id } })); setReviewing(null); }}
                onDeleted={() => { setReviews((m) => { const n = { ...m }; delete n[reviewing.id]; return n; }); setReviewing(null); }}
            />
        )}
        </>
    );
}

function LiveTimer({ startedAt }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#f0d98c] bg-gradient-to-br from-[#fdf3d6] to-[#fff8e5] px-3 py-2.5 sm:px-4 sm:py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8a6d1c] opacity-60" /><span className="relative inline-flex h-full w-full rounded-full bg-[#8a6d1c]" /></span>
            <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-[.18em] text-[#8a6d1c] sm:text-[10px] sm:tracking-[.2em]">{B.sessionWorking}</div>
                <div className="serif mt-0.5 text-xl font-bold tabular-nums text-[#5b4636] sm:text-2xl">{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</div>
            </div>
            <Sparkles size={18} className="shrink-0 text-[#8a6d1c] sm:hidden" /><Sparkles size={20} className="hidden shrink-0 text-[#8a6d1c] sm:block" />
        </div>
    );
}

function MemberInlineTimer({ startedAt }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    if (!startedAt) return null;
    const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const timeString = h > 0
        ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fdf3d6] border border-[#f0d98c] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#8a6d1c]">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8a6d1c] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#8a6d1c]" />
            </span>
            🎨 {timeString}
        </span>
    );
}