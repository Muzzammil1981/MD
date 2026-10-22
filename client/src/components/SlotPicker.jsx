import { useEffect, useState } from "react";
import { Calendar, Clock, Loader2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

const localDate = (offsetDays = 0) => {
    const d = new Date(Date.now() + offsetDays * 864e5);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* Customer picks a date, then one of the time slots that are really free.
   `request` = { items } or { isGroup:true, members } - the server works out how long it takes. */
export default function SlotPicker({ request, date, time, onChange }) {
    const [settings, setSettings] = useState(null);
    const [state, setState] = useState({ loading: false, error: "", data: null });
    const requestKey = JSON.stringify(request);

    useEffect(() => {
        api.get("/api/schedule/settings").then(({ data }) => setSettings(data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (!date || !request) return;
        let cancelled = false;
        setState((s) => ({ ...s, loading: true, error: "" }));
        api.post("/api/schedule/slots", { date, ...request })
            .then(({ data }) => {
                if (cancelled) return;
                setState({ loading: false, error: "", data });
                // the chosen time may have been taken meanwhile
                if (time && !data.slots?.some((s) => s.time === time && s.available)) onChange({ date, time: "" });
            })
            .catch((err) => {
                if (!cancelled) setState({ loading: false, data: null, error: err.response?.data?.message || "Could not load time slots" });
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, requestKey]);

    const { loading, error, data } = state;
    const maxDate = localDate(settings?.advanceDays || 30);
    const freeCount = data?.slots?.filter((s) => s.available).length || 0;

    return (
        <div className="grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                Appointment date
                <div className="relative">
                    <Calendar size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a38974]" />
                    <input required type="date" min={localDate(0)} max={maxDate} value={date}
                        onChange={(e) => onChange({ date: e.target.value, time: "" })}
                        className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                </div>
            </label>

            <div className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Clock size={13} /> Choose a time</span>
                    {data?.minutes ? <span className="font-normal text-[#8a6d53]">Takes about {data.minutes} min</span> : null}
                </div>

                {loading && <div className="grid place-items-center rounded-xl border border-[#eadfce] bg-white py-6 text-[#8a6d53]"><Loader2 size={18} className="animate-spin" /></div>}

                {!loading && (error || data?.ok === false) && (
                    <div className="flex items-start gap-2 rounded-xl bg-[#fdf3d6] px-3 py-3 text-xs font-medium text-[#8a6d1c]">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error || data.reason}
                    </div>
                )}

                {!loading && data?.ok && (
                    freeCount === 0 ? (
                        <div className="rounded-xl bg-[#f8e4df] px-3 py-3 text-xs font-medium text-[#8c392d]">Fully booked on this day. Please try another date.</div>
                    ) : (
                        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                            {data.slots.map((s) => (
                                <button key={s.time} type="button" disabled={!s.available}
                                    onClick={() => onChange({ date, time: s.time })}
                                    className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${time === s.time
                                        ? "border-[#24170f] bg-[#24170f] text-white"
                                        : s.available
                                            ? "border-[#ddcdb8] bg-white text-[#3a281c] hover:border-[#7d3f24] hover:bg-[#fdf7ee]"
                                            : "cursor-not-allowed border-[#eee5d8] bg-[#f6f0e7] text-[#c1b3a2] line-through"}`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
