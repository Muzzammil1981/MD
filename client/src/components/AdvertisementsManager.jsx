import { useEffect, useState } from "react";

import {
    X, Loader2, Plus, Trash2, Play, Pause, Edit3, BarChart3,
    Upload, AlertCircle, CheckCircle2, Eye, RefreshCw,
} from "lucide-react";

import { api } from "../lib/api";
import { toEmbedUrl } from "../lib/adEmbed";
import { currency } from "../lib/format";


const PLAY_MODES = [
    {
        id: "no-session",
        label: "1. Only when the studio is idle",
        hint: "Never interrupt a customer session.",
        detail:
            "When the studio becomes idle, ads can play back-to-back. No interval is applied.",
        example:
            "Example: Ad A finishes → Ad B can play immediately.",
    },
    {
        id: "interval",
        label: "2. Every N minutes — including during sessions",
        hint: "Can interrupt a customer session.",
        detail:
            "The interval is shared globally by campaigns using this mode. At most one eligible ad is triggered per interval.",
        example:
            "Example: With a 20-minute interval, an eligible ad can be triggered after the interval, even during a session.",
    },
    {
        id: "no-session-and-interval",
        label: "3. Only when idle + every N minutes",
        hint: "Never interrupt a customer session.",
        detail:
            "This campaign has its own interval. It becomes eligible after N minutes but waits until the studio is idle.",
        example:
            "Example: If the interval expires during a session, the ad waits until the studio becomes idle.",
    },
];


export default function AdvertisementsManager({ event, onClose }) {
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState(null);
    const [reportAd, setReportAd] = useState(null);



    const [refreshing, setRefreshing] = useState(false);

    const load = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        setError("");

        try {
            const { data } = await api.get(
                `/api/ads?eventId=${event.id}&t=${Date.now()}`
            );
            setAds(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.response?.data?.message || "Could not load ads"
            );
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const refreshAds = async () => {
        if (refreshing) return;

        setRefreshing(true);
        try {
            await load(false);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        load();
    }, [event.id]);


    const toggleActive = async (ad) => {
        try {
            await api.patch(`/api/ads/${ad.id}`, { active: !ad.active });
            load();
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
    };

    const removeAd = async (ad) => {
        if (!confirm(`Delete campaign "${ad.advertiserName}"? This removes all run history.`)) return;
        try {
            await api.delete(`/api/ads/${ad.id}`);
            load();
        } catch (err) { alert(err.response?.data?.message || "Failed"); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#20140e]/70 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()}
                className="flex h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:h-[92vh] sm:rounded-[28px]">

                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eadfce] bg-[#faf5ed] px-4 py-3.5 sm:px-6 sm:py-4">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[.2em] text-[#8a6d53] sm:tracking-[.24em]">Advertisements</div>
                        <div className="serif truncate text-xl font-semibold sm:text-2xl">{event.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setEditing("new")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#24170f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#382419]">
                            <Plus size={14} /> Add campaign
                        </button>
                        <button
                            type="button"
                            onClick={refreshAds}
                            disabled={refreshing}
                            title="Refresh campaigns"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#ded0bc] bg-white px-3 py-2 text-xs font-semibold text-[#5b4636] hover:bg-[#f4eadc] disabled:opacity-60"
                        >
                            <RefreshCw
                                size={14}
                                className={refreshing ? "animate-spin" : ""}
                            />
                            <span>
                                {refreshing ? "Refreshing..." : "Refresh"}
                            </span>
                        </button>
                        <button onClick={onClose}
                            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f1e6d8]">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {error && <div className="mb-4 rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                    {loading ? (
                        <div className="grid h-full place-items-center text-[#8a6d53]"><Loader2 className="animate-spin" /></div>
                    ) : ads.length === 0 ? (
                        <div className="grid h-full place-items-center text-center text-[#8a6d53]">
                            <div>
                                <div className="serif text-2xl">No campaigns yet</div>
                                <div className="mt-1 text-sm">Add your first paid advertisement above.</div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ads.map(ad => (
                                <div key={ad.id} className={`rounded-2xl border-2 bg-white p-4 ${ad.active ? "border-[#eadfce]" : "border-[#d9c7b0] bg-[#faf5ed]"}`}>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="serif text-lg font-semibold">{ad.advertiserName}</div>
                                                {!ad.active && (
                                                    <span className="rounded-full bg-[#f4eadc] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8a6d53]">
                                                        {ad.exhausted ? "Exhausted" : "Paused"}
                                                    </span>
                                                )}
                                                {ad.paid ? (
                                                    <span className="rounded-full bg-[#e2f0e5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1d7a3e]">
                                                        ✓ Paid
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-[#f8e4df] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9b3b2b]">
                                                        Unpaid
                                                    </span>
                                                )}
                                            </div>
                                            {ad.campaignTitle && <div className="mt-0.5 text-sm text-[#5b4636]">{ad.campaignTitle}</div>}
                                            <div className="mt-1 text-[11px] text-[#8a6d53]">
                                                {ad.playMode === "no-session" ? "No session" :
                                                    ad.playMode === "interval" ? `Every ${ad.intervalMinutes} min (global)` :
                                                        `No session + every ${ad.intervalMinutes} min`}
                                                {" · "}
                                                {ad.videos.length} video{ad.videos.length > 1 ? "s" : ""}
                                                {ad.advertiserContact ? ` · ${ad.advertiserContact}` : ""}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-[#7d3f24]">{currency(ad.costPerPlay)}<span className="text-xs text-[#8a6d53]">/play</span></div>
                                            <div className="text-[11px] text-[#8a6d53]">
                                                Total: {ad.totalCost === "N" ? "Unlimited" : currency(ad.totalCost)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-2 rounded-xl bg-[#faf5ed] p-3">
                                        {ad.videos.map(v => {
                                            const isUnlimited = v.purchasedPlays === "N" || v.purchasedPlays === null;
                                            const delivered = v.deliveredPlays;
                                            const pct = isUnlimited ? 100 : v.purchasedPlays > 0 ? Math.min(100, Math.round((delivered / v.purchasedPlays) * 100)) : 0;
                                            return (
                                                <div key={v.id}>
                                                    <div className="flex justify-between text-[11px]">
                                                        <span className="truncate text-[#5b4636]">{v.title} · {v.durationSeconds}s</span>
                                                        <span className="ml-2 shrink-0 font-bold text-[#7d3f24]">
                                                            {delivered} / {isUnlimited ? "∞" : v.purchasedPlays}
                                                        </span>
                                                    </div>
                                                    <div className={`mt-1 h-1.5 w-full overflow-hidden rounded-full ${isUnlimited ? "bg-[#e2f0e5]" : "bg-[#eadfce]"}`}>
                                                        <div className={`h-full rounded-full transition-all ${isUnlimited ? "bg-[#1d7a3e]/40 w-full" : "bg-[#7d3f24]"}`} style={!isUnlimited ? { width: `${pct}%` } : {}} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button onClick={() => setEditing(ad)}
                                            className="inline-flex items-center gap-1 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b4636] hover:bg-[#f4eadc]">
                                            <Edit3 size={12} /> Edit
                                        </button>
                                        <button onClick={() => setReportAd(ad)}
                                            className="inline-flex items-center gap-1 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b4636] hover:bg-[#f4eadc]">
                                            <BarChart3 size={12} /> Runs log
                                        </button>
                                        <button onClick={() => toggleActive(ad)}
                                            className="inline-flex items-center gap-1 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b4636] hover:bg-[#f4eadc]">
                                            {ad.active ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                                        </button>
                                        {ad.videos.map((v, i) => (
                                            <a key={v.id || i} href={v.url} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b4636] hover:bg-[#f4eadc]"
                                                title={v.title}>
                                                <Eye size={12} /> Preview{ad.videos.length > 1 ? ` ${i + 1}` : ""}
                                            </a>
                                        ))}
                                        <button onClick={() => removeAd(ad)}
                                            className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#e6c4be] bg-white px-3 py-1.5 text-xs font-semibold text-[#9b3b2b] hover:bg-[#fdf2ef]">
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {editing && (
                    <AdEditModal
                        eventId={event.id}
                        existing={editing === "new" ? null : editing}
                        onClose={() => setEditing(null)}
                        onSaved={() => { setEditing(null); load(); }}
                    />
                )}

                {reportAd && (
                    <AdReportModal ad={reportAd} onClose={() => setReportAd(null)} />
                )}
            </div>
        </div>
    );
}

/* ============================================================
   Add / Edit modal
   ============================================================ */
function AdEditModal({ eventId, existing, onClose, onSaved }) {
    const isEdit = Boolean(existing);

    const [form, setForm] = useState(() => ({
        advertiserName: existing?.advertiserName || "",
        advertiserContact: existing?.advertiserContact || "",
        campaignTitle: existing?.campaignTitle || "",
        playMode: existing?.playMode || "no-session",
        intervalMinutes: existing?.intervalMinutes || 20,
        costPerPlay: existing?.costPerPlay || 5,
        paid: existing?.paid ?? true,
        videos: existing?.videos?.map(v => ({
            id: v.id,
            url: v.url,
            title: v.title,
            durationSeconds: v.durationSeconds,
            purchasedPlays: v.purchasedPlays === "N" ? "" : v.purchasedPlays,
            isUnlimited: v.purchasedPlays === "N"
        })) || [{ url: "", title: "", durationSeconds: 30, purchasedPlays: 5, isUnlimited: false }],
    }));

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const updateVideo = (idx, patch) => {
        setForm(f => ({
            ...f,
            videos: f.videos.map((v, i) => {
                if (i === idx) {
                    const updated = { ...v, ...patch };
                    if (patch.isUnlimited !== undefined) {
                        updated.purchasedPlays = patch.isUnlimited ? "N" : (v.purchasedPlays === "N" ? 5 : v.purchasedPlays);
                    }
                    return updated;
                }
                return v;
            })
        }));
    };

    const addVideo = () => setForm(f => ({
        ...f,
        videos: [...f.videos, { url: "", title: "", durationSeconds: 30, purchasedPlays: 5, isUnlimited: false }],
    }));

    const removeVideo = (idx) => setForm(f => ({
        ...f,
        videos: f.videos.filter((_, i) => i !== idx),
    }));

    const submit = async (e) => {
        e.preventDefault();
        setError("");

        const enriched = [];
        for (let i = 0; i < form.videos.length; i++) {
            const v = form.videos[i];
            if (!v.url?.trim()) return setError(`Video ${i + 1}: URL is required`);
            const { embedUrl, source } = toEmbedUrl(v.url);
            if (!embedUrl) return setError(`Video ${i + 1}: could not detect embed URL`);
            if (!v.title?.trim()) return setError(`Video ${i + 1}: title is required`);
            if (!v.durationSeconds || v.durationSeconds < 5) return setError(`Video ${i + 1}: duration must be ≥ 5 seconds`);

            const isUnlimited = v.isUnlimited || v.purchasedPlays === "N";
            if (!isUnlimited && (!v.purchasedPlays || Number(v.purchasedPlays) < 1)) {
                return setError(`Video ${i + 1}: purchased plays must be ≥ 1`);
            }

            enriched.push({
                ...v,
                purchasedPlays: isUnlimited ? "N" : Number(v.purchasedPlays),
                embedUrl,
                source
            });
        }

        setBusy(true);
        try {
            const body = {
                eventId,
                advertiserName: form.advertiserName,
                advertiserContact: form.advertiserContact,
                campaignTitle: form.campaignTitle,
                playMode: form.playMode,
                intervalMinutes: form.playMode === "no-session" ? null : form.intervalMinutes,
                costPerPlay: Number(form.costPerPlay) || 0,
                paid: form.paid,
                videos: enriched,
            };
            if (isEdit) {
                await api.patch(`/api/ads/${existing.id}`, body);
            } else {
                await api.post(`/api/ads`, body);
            }
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || "Could not save");
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:rounded-[28px]">
                <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-5 py-4">
                    <div className="serif text-xl font-semibold">{isEdit ? "Edit campaign" : "New ad campaign"}</div>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-[#f1e6d8]"><X size={18} /></button>
                </div>

                <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Advertiser name *
                            <input required value={form.advertiserName}
                                onChange={e => setForm({ ...form, advertiserName: e.target.value })}
                                placeholder="e.g. Joe's Pizza"
                                className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Contact (optional)
                            <input value={form.advertiserContact}
                                onChange={e => setForm({ ...form, advertiserContact: e.target.value })}
                                placeholder="email / phone"
                                className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                        </label>
                    </div>

                    <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                        Campaign title (optional)
                        <input value={form.campaignTitle}
                            onChange={e => setForm({ ...form, campaignTitle: e.target.value })}
                            placeholder="e.g. Weekend Offer"
                            className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                    </label>

                    <div>
                        <div className="mb-2 text-xs font-semibold text-[#5b4636]">When should this campaign play?</div>
                        <div className="space-y-2">
                            {PLAY_MODES.map(m => (
                                <label key={m.id}
                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${form.playMode === m.id ? "border-[#7d3f24] bg-[#fdf9ef]" : "border-[#eadfce] bg-white hover:border-[#b07a4f]"}`}>
                                    <input type="radio" name="playMode" value={m.id}
                                        checked={form.playMode === m.id}
                                        onChange={e => setForm({ ...form, playMode: e.target.value })}
                                        className="mt-1 accent-[#7d3f24]" />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold">{m.label}</div>
                                        <div className="text-[11px] font-medium text-[#8a6d53]">{m.hint}</div>
                                        <p className="mt-1.5 text-[11px] text-[#5b4636] leading-relaxed">{m.detail}</p>
                                        <p className="mt-1 text-[11px] italic text-[#a17e63]">{m.example}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {form.playMode !== "no-session" && (
                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Interval (minutes) *
                            <input required type="number" min="1" max="240"
                                value={form.intervalMinutes}
                                onChange={e => setForm({ ...form, intervalMinutes: e.target.value })}
                                className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                        </label>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Cost per play (£)
                            <input type="number" min="0" step="0.01"
                                value={form.costPerPlay}
                                onChange={e => setForm({ ...form, costPerPlay: e.target.value })}
                                className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-[#eadfce] bg-white px-4 py-3 text-sm">
                            <input type="checkbox" checked={form.paid}
                                onChange={e => setForm({ ...form, paid: e.target.checked })}
                                className="accent-[#7d3f24]" />
                            Advertiser has paid
                        </label>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-[#5b4636]">Videos ({form.videos.length})</div>
                            <button type="button" onClick={addVideo}
                                className="inline-flex items-center gap-1 rounded-full bg-[#7d3f24] px-3 py-1.5 text-[10px] font-bold text-white">
                                <Plus size={11} /> Add video
                            </button>
                        </div>

                        <div className="space-y-2">
                            {form.videos.map((v, idx) => (
                                <div key={idx} className="rounded-xl border border-[#eadfce] bg-white p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="grid h-7 w-7 place-items-center rounded-full bg-[#f1cf8a]/40 text-xs font-bold text-[#7d3f24]">
                                            {idx + 1}
                                        </div>
                                        {form.videos.length > 1 && (
                                            <button type="button" onClick={() => removeVideo(idx)}
                                                className="rounded-full p-1.5 text-[#a17e63] hover:bg-red-50 hover:text-red-500">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <label className="grid gap-1 text-[11px] font-semibold text-[#5b4636] sm:col-span-2">
                                            Video URL *
                                            <input required value={v.url}
                                                onChange={e => updateVideo(idx, { url: e.target.value })}
                                                placeholder="https://www.youtube.com/watch?v=..."
                                                className="rounded-lg border border-[#ddcdb8] bg-white px-3 py-2 text-xs font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                                        </label>
                                        <label className="grid gap-1 text-[11px] font-semibold text-[#5b4636]">
                                            Title *
                                            <input required value={v.title}
                                                onChange={e => updateVideo(idx, { title: e.target.value })}
                                                placeholder="Pizza ad — 30s"
                                                className="rounded-lg border border-[#ddcdb8] bg-white px-3 py-2 text-xs font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="grid gap-1 text-[11px] font-semibold text-[#5b4636]">
                                                Duration (s) *
                                                <input required type="number" min="5"
                                                    value={v.durationSeconds}
                                                    onChange={e => updateVideo(idx, { durationSeconds: e.target.value })}
                                                    className="rounded-lg border border-[#ddcdb8] bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                                            </label>
                                            <label className="grid gap-1 text-[11px] font-semibold text-[#5b4636]">
                                                Plays bought *
                                                <div className="flex items-center gap-2">
                                                    <input required={!v.isUnlimited} type="number" min="1" disabled={v.isUnlimited}
                                                        value={v.isUnlimited ? "" : v.purchasedPlays}
                                                        onChange={e => updateVideo(idx, { purchasedPlays: e.target.value })}
                                                        className="w-full rounded-lg border border-[#ddcdb8] bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#b07a4f] disabled:bg-[#f4eadc] disabled:text-[#a17e63]" />
                                                    <label className="flex shrink-0 items-center gap-1 text-[10px] text-[#8a6d53] font-normal cursor-pointer">
                                                        <input type="checkbox" checked={!!v.isUnlimited}
                                                            onChange={e => updateVideo(idx, { isUnlimited: e.target.checked, purchasedPlays: e.target.checked ? "N" : 5 })}
                                                            className="accent-[#7d3f24]" />
                                                        ∞ (Unlimited)
                                                    </label>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                    <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                        <button type="button" onClick={onClose}
                            className="w-full rounded-full border border-[#ded0bc] bg-white px-4 py-3 text-sm font-semibold sm:flex-1">
                            Cancel
                        </button>
                        <button disabled={busy} type="submit"
                            className="w-full rounded-full bg-[#24170f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-1">
                            {busy ? "Saving…" : isEdit ? "Save changes" : "Create campaign"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ============================================================
   Runs log modal — now shows the video name column
   ============================================================ */
function AdReportModal({ ad, onClose }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get(`/api/ads/${ad.id}/report`)
            .then(({ data }) => setReport(data))
            .catch(err => setError(err.response?.data?.message || "Could not load report"))
            .finally(() => setLoading(false));
    }, [ad.id]);

    // Look up a video title for a run. Prefer the title frozen on the run
    // record; fall back to the campaign's current videos by videoId.
    const titleForRun = (r) => {
        if (r.videoTitle) return r.videoTitle;
        const v = ad.videos?.find(x => x.id === r.videoId);
        return v?.title || "—";
    };

    const downloadCsv = () => {
        if (!report) return;
        const rows = [
            ["Video", "Started", "Ended", "Duration (s)", "Completed", "Rejected"],
            ...report.runs.map(r => [
                titleForRun(r),
                r.startedAt,
                r.endedAt || "",
                r.durationSeconds || 0,
                r.completed ? "yes" : "no",
                r.rejected ? "yes" : "no",
            ]),
        ];
        const csv = rows.map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ad-runs-${ad.advertiserName.replace(/\s+/g, "-")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:rounded-[28px]">
                <div className="flex shrink-0 items-center justify-between border-b border-[#eadfce] px-5 py-4">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-[#8a6d53]">Runs log</div>
                        <div className="serif truncate text-xl font-semibold">{ad.advertiserName}</div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-[#f1e6d8]"><X size={18} /></button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {loading ? (
                        <div className="grid h-40 place-items-center text-[#8a6d53]"><Loader2 className="animate-spin" /></div>
                    ) : error ? (
                        <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>
                    ) : (
                        <>
                            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <Stat label="Total runs" value={report.summary.totalRuns} />
                                <Stat label="Completed" value={report.summary.completedRuns} tone="ok" />
                                <Stat label="Interrupted" value={report.summary.interruptedRuns} tone="warn" />
                                <Stat label="Screen time" value={`${Math.round(report.summary.totalScreenTime / 60)}m`} />
                            </div>

                            <button onClick={downloadCsv}
                                className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b4636] hover:bg-[#f4eadc]">
                                <Upload size={12} className="rotate-180" /> Download CSV
                            </button>

                            {report.runs.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#d9c7b0] bg-white p-8 text-center text-sm text-[#8a6d53]">
                                    No runs logged yet.
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl border border-[#eadfce]">
                                    <table className="w-full text-xs">
                                        <thead className="bg-[#faf5ed] text-left text-[10px] uppercase tracking-wider text-[#8a6d53]">
                                            <tr>
                                                <th className="px-3 py-2">Video</th>
                                                <th className="px-3 py-2">Started</th>
                                                <th className="px-3 py-2">Duration</th>
                                                <th className="px-3 py-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.runs.map(r => (
                                                <tr key={r.id} className="border-t border-[#f0e6d8]">
                                                    <td className="px-3 py-2">
                                                        <span className="font-semibold text-[#7d3f24]">{titleForRun(r)}</span>
                                                    </td>
                                                    <td className="px-3 py-2 font-mono text-[11px]">{new Date(r.startedAt).toLocaleString()}</td>
                                                    <td className="px-3 py-2 tabular-nums">{r.durationSeconds}s</td>
                                                    <td className="px-3 py-2">
                                                        {r.rejected ? (
                                                            <span className="text-[#8a6d53]">⊘ rejected</span>
                                                        ) : r.completed ? (
                                                            <span className="inline-flex items-center gap-1 text-[#1d7a3e]"><CheckCircle2 size={11} /> completed</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[#8a6d1c]"><AlertCircle size={11} /> interrupted</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, tone }) {
    const cls = tone === "ok" ? "text-[#1d7a3e]" : tone === "warn" ? "text-[#8a6d1c]" : "text-[#24170f]";
    return (
        <div className="rounded-xl border border-[#eadfce] bg-white p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#8a6d53]">{label}</div>
            <div className={`serif mt-0.5 text-xl font-bold ${cls}`}>{value}</div>
        </div>
    );
}