import { useState } from "react";
import { X, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { StarInput, RATING_LABELS } from "../components/Stars";
import { B } from "../lib/brand";

/* Write or edit the review of one COMPLETED order */
export default function ReviewModal({ order, existing, onClose, onSaved, onDeleted }) {
    const [rating, setRating] = useState(existing?.rating || 0);
    const [comment, setComment] = useState(existing?.comment || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const names = order.isGroup
        ? `Group of ${order.members?.length || 0}`
        : order.type === "custom" ? `${B.Custom}`
            : (order.items || []).map((i) => i.name).join(", ");

    const save = async (e) => {
        e.preventDefault();
        if (!rating) { setError("Please choose a star rating"); return; }
        setBusy(true); setError("");
        try {
            const { data } = existing
                ? await api.patch(`/api/reviews/${existing.id}`, { rating, comment })
                : await api.post("/api/reviews", { orderId: order.id, rating, comment });
            onSaved(data);
        } catch (err) {
            setError(err.response?.data?.message || "Could not save your review");
        } finally { setBusy(false); }
    };

    const remove = async () => {
        if (!confirm("Delete your review?")) return;
        setBusy(true);
        try { await api.delete(`/api/reviews/${existing.id}`); onDeleted(existing.id); }
        catch (err) { setError(err.response?.data?.message || "Could not delete"); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#20140e]/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
            <form onSubmit={save} onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-md space-y-5 rounded-[26px] bg-[#fffdf9] p-6 shadow-2xl sm:p-7">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7352]">{existing ? "Edit review" : "Your review"}</div>
                        <h2 className="serif mt-1 text-2xl font-semibold">{B.reviewPrompt}</h2>
                        {names && <p className="mt-1 line-clamp-2 text-xs text-[#8a6d53]">{names}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-[#f1e6d8]"><X size={18} /></button>
                </div>

                <div>
                    <StarInput value={rating} onChange={setRating} />
                    <div className="mt-1 h-5 text-sm font-semibold text-[#7d3f24]">{RATING_LABELS[rating]}</div>
                </div>

                <label className="block text-xs font-semibold text-[#5b4636]">
                    Tell others about it (optional)
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={4}
                        placeholder={B.reviewHint}
                        className="mt-1.5 w-full resize-none rounded-xl border border-[#ddcdb8] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                    <div className="mt-1 text-right text-[10px] text-[#9a846f]">{comment.length}/1000</div>
                </label>

                {error && (
                    <div className="flex items-start gap-2 rounded-xl bg-[#f8e4df] px-3 py-2 text-sm text-[#8c392d]">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
                    </div>
                )}

                <div className="flex gap-2">
                    {existing && (
                        <button type="button" onClick={remove} disabled={busy} title="Delete review"
                            className="rounded-full border border-[#e6c4be] px-4 text-[#9b3b2b] hover:bg-[#f7e9e6] disabled:opacity-60"><Trash2 size={16} /></button>
                    )}
                    <button disabled={busy}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#24170f] py-3.5 text-sm font-semibold text-white disabled:opacity-60">
                        {busy && <Loader2 size={15} className="animate-spin" />} {existing ? "Save changes" : "Post review"}
                    </button>
                </div>
                <p className="text-center text-[10px] text-[#9a846f]">Your username and review will be shown publicly.</p>
            </form>
        </div>
    );
}
