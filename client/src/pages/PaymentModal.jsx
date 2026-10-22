import { useEffect, useState } from "react";
import {
    X, Loader2, CheckCircle2, Copy, QrCode, Smartphone, RefreshCw, Hash,
    CreditCard, Banknote,
} from "lucide-react";
import { api } from "../lib/api";

function currency(value) {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value || 0);
}

const METHOD_OPTIONS = [
    { id: "upi", label: "UPI", sub: "Pay now online", icon: Smartphone },
    { id: "card", label: "Card", sub: "Pay at counter", icon: CreditCard },
    { id: "cash", label: "Cash", sub: "Pay at counter", icon: Banknote },
];

export default function PaymentModal({ order, onClose, onPaid }) {
    const [method, setMethod] = useState(
        order.paymentMethod === "cash" || order.paymentMethod === "card"
            ? "upi"
            : (order.paymentMethod || "upi")
    );
    const [qr, setQr] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [copied, setCopied] = useState(false);
    const [utr, setUtr] = useState("");

    // NEW: the amount the customer is being charged right now.
    // If they already paid part of this order, we only charge the balance.
    const totalDue = Number(order.total) || 0;
    const paidAmount = Number(order.paidAmount) || 0;
    const balanceDue = Number(order.balanceDue) || 0;
    const amountDue = balanceDue > 0 ? balanceDue : totalDue;

    const loadQr = async () => {
        setLoading(true); setError("");
        try {
            const { data } = await api.get(`/api/orders/${order.id}/qr`);
            setQr(data);
        } catch (err) {
            setError(err.response?.data?.message || "Could not load payment QR");
        } finally { setLoading(false); }
    };

    useEffect(() => {
        if (method === "upi") loadQr();
        else setLoading(false);
    }, [order.id, method]);

    const copyUpi = () => {
        if (!qr?.upiId) return;
        navigator.clipboard.writeText(qr.upiId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const submitUpiClaim = async (e) => {
        e.preventDefault();
        setError("");
        const clean = utr.trim();
        if (clean.length < 6) return setError("Enter the UTR / Transaction ID from your UPI app");

        setBusy(true);
        try {
            await api.post(`/api/orders/${order.id}/claim-payment`, { utr: clean });
            setDone(true);
            onPaid?.();
        } catch (err) {
            setError(err.response?.data?.message || "Could not submit payment");
        } finally { setBusy(false); }
    };

    const submitCounterChoice = async () => {
        setError("");
        setBusy(true);
        try {
            await api.patch(`/api/orders/${order.id}/payment-method`, { method });
            setDone(true);
            onPaid?.();
        } catch (err) {
            setError(err.response?.data?.message || "Could not save payment method");
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#20140e]/85 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:max-h-[92vh] sm:rounded-[28px]">
                <div className="relative shrink-0 bg-[#24170f] p-5 text-[#f1cf8a] sm:p-6">
                    <button onClick={onClose} aria-label="Close payment" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#f1cf8a] transition hover:bg-white/10 sm:right-4 sm:top-4 sm:h-10 sm:w-10">
                        <X size={18} />
                    </button>
                    <div className="pr-10 text-[10px] uppercase tracking-[.2em] sm:tracking-[.24em]">Payment</div>
                    <h2 className="serif mt-2 pr-10 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                        {done ? "All set ✓" : "Choose payment method"}
                    </h2>
                    <p className="mt-1 pr-10 text-xs text-[#d9c9b8] sm:text-sm">Order #{order.id.slice(0, 8)}</p>
                </div>

                {done ? (
                    <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center sm:p-6">
                        <CheckCircle2 className="mx-auto text-[#1d7a3e]" size={44} />
                        <h3 className="serif mt-4 text-lg font-semibold sm:text-xl">
                            {method === "upi" ? "Waiting for studio confirmation" : "Confirmed — pay at counter"}
                        </h3>
                        <p className="mt-2 text-sm text-[#5b4636]">
                            {method === "upi" ? (
                                <>We received your UTR <strong className="break-all font-mono">{utr.trim()}</strong>. Studio will verify shortly.</>
                            ) : (
                                <>Show this order at the counter. Pay <strong>{currency(amountDue)}</strong> by <strong>{method === "cash" ? "cash" : "card"}</strong>.</>
                            )}
                        </p>
                        <div className="mt-4 rounded-xl bg-[#f5ecdf] px-4 py-3 text-[11px] text-[#5b4636]">
                            {method === "upi" ? "You'll get a live notification the moment payment is confirmed." : "Your token will be assigned once the studio receives your payment."}
                        </div>
                        <button onClick={onClose} className="mt-6 min-h-[48px] w-full rounded-full bg-[#24170f] px-6 py-3 text-sm font-semibold text-white sm:w-auto">Close</button>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
                        {/* Amount — uses balance when there's a top-up */}
                        <div className="rounded-2xl bg-[#f5ecdf] p-4 text-center">
                            <div className="text-[11px] uppercase tracking-[.15em] text-[#8a6d53] sm:text-xs">
                                {paidAmount > 0 && balanceDue > 0 ? "Balance to pay" : "Amount to pay"}
                            </div>
                            <div className="serif mt-1 text-2xl font-bold text-[#24170f] sm:text-3xl">{currency(amountDue)}</div>
                            {paidAmount > 0 && balanceDue > 0 && (
                                <div className="mt-1 text-[11px] text-[#8a6d53]">
                                    Total {currency(totalDue)} · already paid {currency(paidAmount)}
                                </div>
                            )}
                        </div>

                        {/* Method tabs */}
                        <div className="mt-5 grid grid-cols-3 gap-2">
                            {METHOD_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const active = method === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => { setMethod(opt.id); setError(""); }}
                                        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 transition ${active
                                            ? "border-[#24170f] bg-[#24170f] text-white shadow-lg"
                                            : "border-[#eadfce] bg-white text-[#5b4636] hover:border-[#b07a4f]"
                                            }`}
                                    >
                                        <Icon size={20} className={active ? "text-[#f1cf8a]" : "text-[#7d3f24]"} />
                                        <div className="text-[11px] font-bold uppercase tracking-wide">{opt.label}</div>
                                        <div className={`text-[9px] ${active ? "text-[#d9c9b8]" : "text-[#8a6d53]"}`}>{opt.sub}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {method === "upi" && (
                            <>
                                {loading ? (
                                    <div className="grid h-40 place-items-center text-[#8a6d53]"><Loader2 className="animate-spin" /></div>
                                ) : (
                                    <>
                                        <div className="mt-4 grid place-items-center">
                                            {qr?.qrCodeDataUrl ? (
                                                <div className="rounded-2xl border border-[#eadfce] bg-white p-3">
                                                    <img src={qr.qrCodeDataUrl} alt="UPI QR" className="h-44 w-44 rounded-lg object-contain sm:h-52 sm:w-52" />
                                                </div>
                                            ) : (
                                                <div className="grid h-44 w-44 place-items-center rounded-2xl border-2 border-dashed border-[#d9c7b0] bg-[#faf5ed] text-center text-xs text-[#8a6d53] sm:h-52 sm:w-52">
                                                    <div><QrCode className="mx-auto mb-2" size={28} />QR unavailable.</div>
                                                </div>
                                            )}
                                            <button onClick={loadQr} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#7d3f24] hover:underline">
                                                <RefreshCw size={11} /> Refresh QR
                                            </button>
                                        </div>

                                        {qr?.upiId && (
                                            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#eadfce] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-[10px] uppercase tracking-[.18em] text-[#8a6d53]">UPI ID</div>
                                                    <div className="mt-0.5 break-all font-mono text-xs font-semibold sm:text-sm">{qr.upiId}</div>
                                                </div>
                                                <button onClick={copyUpi} className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f4eadc] sm:min-h-0">
                                                    {copied ? <>✓ Copied</> : <><Copy size={12} /> Copy</>}
                                                </button>
                                            </div>
                                        )}

                                        <form onSubmit={submitUpiClaim} className="mt-4 grid gap-3">
                                            <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                                                UTR / Transaction ID from your UPI app
                                                <div className="relative">
                                                    <Hash size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a38974]" />
                                                    <input
                                                        required
                                                        value={utr}
                                                        onChange={e => setUtr(e.target.value)}
                                                        placeholder="e.g. 415823912345"
                                                        autoComplete="off"
                                                        autoCapitalize="characters"
                                                        spellCheck={false}
                                                        className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 font-mono text-base uppercase outline-none focus:ring-2 focus:ring-[#b07a4f] sm:text-sm"
                                                    />
                                                </div>
                                            </label>
                                            {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}
                                            <button type="submit" disabled={busy || !qr?.qrCodeDataUrl} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60 hover:-translate-y-0.5 disabled:hover:translate-y-0">
                                                {busy ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : "I have paid — submit for verification"}
                                            </button>
                                        </form>
                                    </>
                                )}
                            </>
                        )}

                        {method === "card" && (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-2xl border border-[#eadfce] bg-white p-4 text-sm text-[#5b4636]">
                                    <div className="flex items-start gap-3">
                                        <CreditCard size={20} className="mt-0.5 shrink-0 text-[#7d3f24]" />
                                        <div>
                                            <div className="font-semibold text-[#24170f]">Pay by card at counter</div>
                                            <p className="mt-1 text-xs">
                                                Show this order at the counter and pay <strong>{currency(amountDue)}</strong> by card.
                                                {paidAmount > 0 && balanceDue > 0 && <> You've already paid {currency(paidAmount)}; the remaining is {currency(balanceDue)}.</>}
                                                {" "}The studio will mark your payment and assign your token.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}
                                <button onClick={submitCounterChoice} disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60 hover:-translate-y-0.5 disabled:hover:translate-y-0">
                                    {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Confirm — I'll pay at counter"}
                                </button>
                            </div>
                        )}

                        {method === "cash" && (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-2xl border border-[#eadfce] bg-white p-4 text-sm text-[#5b4636]">
                                    <div className="flex items-start gap-3">
                                        <Banknote size={20} className="mt-0.5 shrink-0 text-[#7d3f24]" />
                                        <div>
                                            <div className="font-semibold text-[#24170f]">Pay by cash at counter</div>
                                            <p className="mt-1 text-xs">
                                                Show this order at the counter and pay <strong>{currency(amountDue)}</strong> in cash.
                                                {paidAmount > 0 && balanceDue > 0 && <> You've already paid {currency(paidAmount)}; the remaining is {currency(balanceDue)}.</>}
                                                {" "}The studio will mark your payment and assign your token.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}
                                <button onClick={submitCounterChoice} disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60 hover:-translate-y-0.5 disabled:hover:translate-y-0">
                                    {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Confirm — I'll pay at counter"}
                                </button>
                            </div>
                        )}

                        <p className="mt-3 text-center text-[10px] text-[#8a6d53]">
                            Studio will verify your payment before confirming.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}