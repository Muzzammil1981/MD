import { useState } from "react";
import SlotPicker from "../components/SlotPicker";
import {
    X, Calendar, Clock, FileText, Loader2, CheckCircle2, Sparkles,
    Users, Plus, Trash2, AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { currency } from "../lib/format";
import { B } from "../lib/brand";

export default function BookingModal({ cart, total, activeEvent, onClose, onSuccess }) {
    const localToday = (() => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

    // Prefer eventId from cart items; fall back to the active event context
    const eventIdFromCart = cart.length > 0 ? cart[0].eventId : null;
    const eventId = eventIdFromCart || activeEvent?.id || null;
    const isEventOrder = Boolean(eventId);
    const eventName = activeEvent?.name || "";

    const [form, setForm] = useState({
        requestedDate: localToday,
        requestedTime: "",          // chosen from the free slots
        notes: "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(null);

    /* Group mode */
    const [isGroup, setIsGroup] = useState(false);
    const [members, setMembers] = useState([{ memberId: "m-1", name: "" }, { memberId: "m-2", name: "" }]);
    const [assignments, setAssignments] = useState({});

    const addMember = () => {
        if (members.length >= 10) return;
        setMembers(prev => [...prev, { memberId: `m-${prev.length + 1}`, name: "" }]);
    };

    const removeMember = (idx) => {
        if (members.length <= 2) return;
        setMembers(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, memberId: `m-${i + 1}` })));
        setAssignments(prev => {
            const next = {};
            let newIdx = 0;
            for (let i = 0; i < members.length; i++) {
                if (i === idx) continue;
                if (prev[i]) next[newIdx] = prev[i];
                newIdx++;
            }
            return next;
        });
    };

    const toggleAssignment = (memberIdx, cartItemId) => {
        setAssignments(prev => {
            const current = new Set(prev[memberIdx] || []);
            if (current.has(cartItemId)) current.delete(cartItemId);
            else current.add(cartItemId);
            return { ...prev, [memberIdx]: current };
        });
    };

    const buildMemberPayload = () => {
        return members.map((m, idx) => {
            const assignedIds = assignments[idx] || new Set();
            const items = cart
                .filter(ci => assignedIds.has(ci.id))
                .map(({ id, name, price, qty, image, categoryName, amountType }) => ({
                    id, name, price, qty, image, categoryName, amountType,
                }));
            return {
                memberId: m.memberId,
                name: m.name.trim() || `Member ${idx + 1}`,
                items,
            };
        });
    };

    const groupTotal = members.reduce((sum, _, idx) => {
        const assignedIds = assignments[idx] || new Set();
        return sum + cart
            .filter(ci => assignedIds.has(ci.id))
            .reduce((n, ci) => n + ci.price * ci.qty, 0);
    }, 0);

    // what the slot picker sends: the server turns it into a duration
    const groupSlotMembers = isGroup
        ? buildMemberPayload().map(m => ({ items: m.items.map(({ id, qty }) => ({ id, qty })) })).filter(m => m.items.length)
        : [];
    const slotRequest = isGroup
        ? (groupSlotMembers.length ? { isGroup: true, members: groupSlotMembers } : null)   // null = nothing assigned yet
        : { items: cart.map(({ id, qty }) => ({ id, qty })) };

    const unassignedItems = cart.filter(ci => {
        const used = new Set();
        Object.values(assignments).forEach(set => set.forEach(id => used.add(id)));
        return !used.has(ci.id);
    });

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");

        try {
            let payload = {
                notes: form.notes,
                isGroup: false,
            };

            if (isGroup) {
                if (members.length < 2) throw new Error("Add at least 2 members");
                if (members.some(m => !m.name.trim())) throw new Error("Enter a name for each member");
                const memberPayload = buildMemberPayload();
                if (memberPayload.some(m => m.items.length === 0)) {
                    throw new Error(`Each member needs at least one ${B.item} assigned`);
                }
                payload.isGroup = true;
                payload.members = memberPayload;
                payload.items = [];
            } else {
                payload.items = cart.map(({ id, name, price, qty, image, categoryName, amountType }) => ({
                    id, name, price, qty, image, categoryName, amountType,
                }));
            }

            if (!isEventOrder && !form.requestedTime) throw new Error("Please choose a time slot");

            if (isEventOrder) {
                payload.eventId = eventId;
                payload.requestedDate = new Date().toISOString().split("T")[0];
                payload.requestedTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } else {
                payload.requestedDate = form.requestedDate;
                payload.requestedTime = form.requestedTime;
            }

            const { data } = await api.post("/api/orders", payload);

            if (isEventOrder) {
                onSuccess?.(data);
                return;
            }

            setDone(data);
            onSuccess?.(data);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Could not submit booking");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-[#20140e]/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:max-h-[90vh] sm:rounded-[28px]">

                <div className="relative shrink-0 bg-[#24170f] p-5 text-[#f1cf8a] sm:p-6">
                    <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#f1cf8a] transition hover:bg-white/10 sm:right-4 sm:top-4 sm:h-10 sm:w-10"><X size={18} /></button>
                    <div className="pr-10 text-[10px] uppercase tracking-[.2em] sm:tracking-[.24em]">
                        {isEventOrder ? `Event Order${eventName ? ` · ${eventName}` : ""}` : "Appointment request"}
                    </div>
                    <h2 className="serif mt-2 pr-10 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                        {done ? "Request sent ✓" : (isGroup ? "Group booking" : (isEventOrder ? "Confirm your order" : "Choose your slot"))}
                    </h2>
                    <p className="mt-1 pr-10 text-xs text-[#d9c9b8] sm:text-sm">
                        {done ? "The admin will confirm shortly." : isGroup ? `${members.length} people · ${currency(groupTotal)}` : `${cart.length} ${cart.length > 1 ? B.items : B.item} · ${currency(total)}`}
                    </p>
                </div>

                {done ? (
                    <div className="min-h-0 flex-1 overflow-y-auto p-5 text-center sm:p-6">
                        <CheckCircle2 className="mx-auto text-[#1d7a3e]" size={44} />
                        <p className="mt-4 text-sm text-[#5b4636] sm:text-base">
                            Your request for <strong>{done.requestedDate}</strong> at <strong>{done.requestedTime}</strong> has been sent.
                        </p>
                        {done.isGroup && (
                            <div className="mt-4 rounded-xl bg-[#f5ecdf] px-4 py-3 text-left text-xs text-[#5b4636]">
                                <div className="font-bold text-[#24170f]">Your group</div>
                                <ul className="mt-1 space-y-0.5">
                                    {done.members.map((m, i) => <li key={i}>• {m.name} — {currency(m.subtotal)}</li>)}
                                </ul>
                            </div>
                        )}
                        <button onClick={onClose} className="mt-6 min-h-[48px] w-full rounded-full bg-[#24170f] px-6 py-3 text-sm font-semibold text-white sm:w-auto">Close</button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="grid min-h-0 flex-1 gap-3.5 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-4 sm:p-6">

                        {/* Group toggle — visible in both event and non-event mode */}
                        <div className="flex gap-2 rounded-full border border-[#ded0bc] bg-white p-1">
                            <button type="button" onClick={() => setIsGroup(false)} className={`flex-1 rounded-full px-4 py-2 text-xs font-bold transition ${!isGroup ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}>
                                Just me
                            </button>
                            <button type="button" onClick={() => setIsGroup(true)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${isGroup ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}>
                                <Users size={13} /> Group / Family
                            </button>
                        </div>

                        {isGroup && (
                            <div className="rounded-2xl border border-[#f1cf8a] bg-[#fdf9ef] p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="text-xs font-bold uppercase tracking-widest text-[#7d3f24]">
                                        <Users size={13} className="mr-1 inline" /> Members ({members.length})
                                    </div>
                                    <button type="button" onClick={addMember} disabled={members.length >= 10} className="rounded-full bg-[#7d3f24] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-40">
                                        <Plus size={11} className="mr-1 inline" /> Add
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {members.map((m, idx) => {
                                        const assignedIds = assignments[idx] || new Set();
                                        const subtotal = cart
                                            .filter(ci => assignedIds.has(ci.id))
                                            .reduce((n, ci) => n + ci.price * ci.qty, 0);

                                        return (
                                            <div key={idx} className="rounded-xl border border-[#eadfce] bg-white p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#f1cf8a]/40 text-xs font-bold text-[#7d3f24]">
                                                        {idx + 1}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder={`Name (e.g. Aisha)`}
                                                        value={m.name}
                                                        onChange={e => setMembers(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                                        className="flex-1 rounded-lg border border-[#ddcdb8] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                                    />
                                                    {members.length > 2 && (
                                                        <button type="button" onClick={() => removeMember(idx)} className="rounded-full p-1.5 text-[#a17e63] hover:bg-red-50 hover:text-red-500">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    {cart.map(ci => {
                                                        const checked = assignedIds.has(ci.id);
                                                        return (
                                                            <label key={ci.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[#f4eadc]">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleAssignment(idx, ci.id)}
                                                                    className="accent-[#7d3f24]"
                                                                />
                                                                <span className="flex-1 truncate">{ci.qty}× {ci.name}</span>
                                                                <span className="shrink-0 font-bold text-[#7d3f24]">{currency(ci.price * ci.qty)}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-2 flex justify-between border-t border-[#f0e6d8] pt-2 text-xs">
                                                    <span className="text-[#8a6d53]">Subtotal</span>
                                                    <span className="font-bold text-[#24170f]">{currency(subtotal)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {unassignedItems.length > 0 && (
                                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#fdf3d6] px-3 py-2 text-[11px] text-[#8a6d1c]">
                                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                                        <span>Unassigned: {unassignedItems.map(i => i.name).join(", ")}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Date + Time — hidden when event order */}
                        {!isEventOrder && (
                            <>
                                {!slotRequest && <div className="rounded-xl bg-[#fdf3d6] px-3 py-3 text-xs font-medium text-[#8a6d1c]">Assign {B.items} to your group members first, then pick a time.</div>}
                                {slotRequest && <SlotPicker
                                    request={slotRequest}
                                    date={form.requestedDate}
                                    time={form.requestedTime}
                                    onChange={({ date, time }) => setForm((f) => ({ ...f, requestedDate: date, requestedTime: time }))}
                                />}
                            </>
                        )}

                        {isEventOrder && (
                            <div className="rounded-xl bg-[#fdf3d6] border border-[#f0d98c] p-4 text-sm text-[#8a6d1c] mb-1">
                                <div className="font-semibold flex items-center gap-2"><Sparkles size={16} /> First Come, First Serve</div>
                                <p className="mt-1 text-xs">
                                    {isGroup
                                        ? `Each of your ${members.length} members will get their own token number after payment.`
                                        : "Your token number will be generated automatically once your payment is confirmed."}
                                </p>
                            </div>
                        )}

                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Notes for the artist (optional)
                            <div className="relative">
                                <FileText size={15} className="pointer-events-none absolute left-3.5 top-3 text-[#a38974]" />
                                <textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Occasion, style preferences, add-ons…" className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                            </div>
                        </label>

                        {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                        <button disabled={busy} type="submit" className="mt-1 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60 hover:-translate-y-0.5 disabled:hover:translate-y-0">
                            {busy ? <><Loader2 size={15} className="animate-spin" /> Processing…</> : (
                                isEventOrder
                                    ? (isGroup ? `Continue to Payment (${members.length} tokens)` : "Continue to Payment")
                                    : "Send appointment request"
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}