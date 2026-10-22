import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle, Star } from "lucide-react";
import { api } from "../lib/api";
import { Stars } from "./Stars";

/* Admin: all reviews (an Admin sees only reviews of THEIR events). Hide / show a review. */
export default function ReviewsManager() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        api.get("/api/reviews/admin/all")
            .then(({ data }) => setList(data))
            .catch((e) => setError(e.response?.data?.message || "Could not load reviews"))
            .finally(() => setLoading(false));
    }, []);

    const toggle = async (r) => {
        setBusyId(r.id); setError("");
        try {
            const { data } = await api.patch(`/api/reviews/admin/${r.id}/hidden`, { hidden: !r.hidden });
            setList((l) => l.map((x) => (x.id === r.id ? { ...x, hidden: data.hidden } : x)));
        } catch (e) { setError(e.response?.data?.message || "Update failed"); }
        finally { setBusyId(null); }
    };

    const visible = list.filter((r) => !r.hidden);
    const avg = visible.length ? visible.reduce((n, r) => n + r.rating, 0) / visible.length : 0;
    const shown = list.filter((r) => filter === "all" || (filter === "hidden" ? r.hidden : !r.hidden));

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="serif text-2xl font-semibold">Customer reviews</h2>
                    <p className="text-sm text-[#715e4e]">Reviews appear on the website straight away. Hide any that shouldn't be public.</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#eadfce] bg-white px-4 py-2 shadow-sm">
                    <Star size={18} className="fill-[#c8923a] text-[#c8923a]" />
                    <span className="serif text-2xl font-semibold">{avg.toFixed(1)}</span>
                    <span className="text-xs text-[#8a6d53]">{visible.length} public</span>
                </div>
            </div>

            <div className="flex gap-2">
                {[["all", "All"], ["visible", "Visible"], ["hidden", "Hidden"]].map(([k, label]) => (
                    <button key={k} onClick={() => setFilter(k)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold ${filter === k ? "bg-[#24170f] text-white" : "border border-[#ded0bc] bg-white hover:bg-[#f4eadc]"}`}>
                        {label}
                    </button>
                ))}
            </div>

            {error && <div className="flex items-start gap-2 rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

            <div className="overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-sm">
                {loading ? (
                    <div className="p-10 text-center text-[#8a6d53]"><Loader2 className="mx-auto animate-spin" /></div>
                ) : shown.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#8a6d53]">No reviews yet.</div>
                ) : (
                    <ul className="divide-y divide-[#f0e6d6]">
                        {shown.map((r) => (
                            <li key={r.id} className={`flex flex-wrap items-start justify-between gap-3 p-4 ${r.hidden ? "bg-[#faf4ee] opacity-70" : ""}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Stars value={r.rating} size={14} />
                                        <span className="text-sm font-semibold">{r.username}</span>
                                        <span className="text-[11px] text-[#9a846f]">{new Date(r.createdAt).toLocaleString()}</span>
                                        {r.hidden && <span className="rounded-full bg-[#f3e0dc] px-2 py-0.5 text-[10px] font-bold text-[#9b3b2b]">Hidden</span>}
                                    </div>
                                    {r.comment && <p className="mt-1.5 break-words text-sm text-[#4a3a2d]">{r.comment}</p>}
                                    <div className="mt-1.5 truncate text-[11px] text-[#8a6d53]">
                                        {[r.designs?.map((d) => d.name).join(", "), r.eventName && `Event: ${r.eventName}`].filter(Boolean).join(" · ") || "-"}
                                    </div>
                                </div>
                                <button onClick={() => toggle(r)} disabled={busyId === r.id}
                                    className="flex items-center gap-1.5 rounded-full border border-[#ded0bc] px-3 py-2 text-xs font-semibold hover:bg-[#f4eadc] disabled:opacity-60">
                                    {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : r.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                    {r.hidden ? "Show" : "Hide"}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
