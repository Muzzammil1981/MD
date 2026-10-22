import { useEffect, useState } from "react";
import { Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* SuperAdmin: opening hours, booking grid, number of stations (chairs / stylists / bays), closed days */
export default function ScheduleCard({ industryName }) {
    const [s, setS] = useState(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    useEffect(() => { api.get("/api/schedule/settings").then(({ data }) => setS(data)).catch(() => { }); }, []);
    if (!s) return null;

    const set = (patch) => setS({ ...s, ...patch });
    const toggleDay = (d) => set({ closedDays: s.closedDays.includes(d) ? s.closedDays.filter((x) => x !== d) : [...s.closedDays, d] });

    const save = async (e) => {
        e.preventDefault();
        setBusy(true); setMsg({ type: "", text: "" });
        try {
            const { data } = await api.put("/api/schedule/settings", s);
            setS(data); setMsg({ type: "ok", text: "Schedule saved ✓" });
        } catch (err) { setMsg({ type: "err", text: err.response?.data?.message || "Could not save" }); }
        finally { setBusy(false); }
    };

    const input = "w-full rounded-xl border border-[#ddcdb8] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]";
    return (
        <form onSubmit={save} className="rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex items-center gap-2">
                <Clock size={18} className="text-[#7d3f24]" />
                <h3 className="serif text-xl font-semibold">Booking schedule{industryName ? ` · ${industryName}` : ""}</h3>
            </div>
            <p className="mt-1 text-xs text-[#715e4e]">
                Controls the time slots customers can book (normal bookings; event tokens are not affected).
                A <strong>station</strong> is how many customers you can serve at the same time - chairs, stylists, wash bays or rooms.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Opens
                    <input type="time" required className={input} value={s.openTime} onChange={(e) => set({ openTime: e.target.value })} /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Closes
                    <input type="time" required className={input} value={s.closeTime} onChange={(e) => set({ closeTime: e.target.value })} /></label>
                <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Slot every
                    <select className={input} value={s.slotMinutes} onChange={(e) => set({ slotMinutes: Number(e.target.value) })}>
                        {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                    </select></label>
                <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Stations
                    <input type="number" min={1} max={50} required className={input} value={s.stations} onChange={(e) => set({ stations: Number(e.target.value) })} /></label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                    <div className="text-xs font-semibold text-[#5b4636]">Closed on</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {DAYS.map((d, i) => (
                            <button key={d} type="button" onClick={() => toggleDay(i)}
                                className={`rounded-full px-3.5 py-2 text-xs font-semibold ${s.closedDays.includes(i) ? "bg-[#9b3b2b] text-white" : "border border-[#ded0bc] bg-white hover:bg-[#f4eadc]"}`}>{d}</button>
                        ))}
                    </div>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Book up to (days ahead)
                    <input type="number" min={1} max={365} required className={input} value={s.advanceDays} onChange={(e) => set({ advanceDays: Number(e.target.value) })} /></label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button disabled={busy} className="flex items-center gap-2 rounded-full bg-[#24170f] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {busy && <Loader2 size={14} className="animate-spin" />} Save schedule
                </button>
                {msg.text && (
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${msg.type === "ok" ? "text-[#1d7a3e]" : "text-[#8c392d]"}`}>
                        {msg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {msg.text}
                    </span>
                )}
            </div>
        </form>
    );
}
