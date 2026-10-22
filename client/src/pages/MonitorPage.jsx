import { useEffect, useState } from "react";
import { Sparkles, Clock, Wifi, WifiOff, CheckCircle2, Users, Ticket, Timer, Maximize, Minimize, Palette, Volume2, VolumeX } from "lucide-react";
import { api, API_BASE } from "../lib/api";
import AdPlayer from "../components/AdPlayer";
import useAdScheduler from "../hooks/useAdScheduler";
import { B } from "../lib/brand";

const BASE_SECONDS = 30 * 60;
const EXTEND_SECONDS = 10 * 60;

const buildImageUrl = (src) => {
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    return `${API_BASE}${src}`;
};

const formatTimer = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const getProgress = (elapsed, base) => {
    let total = base;
    let extensions = 0;
    if (elapsed >= base) {
        extensions = Math.floor((elapsed - base) / EXTEND_SECONDS) + 1;
        total = base + extensions * EXTEND_SECONDS;
    }
    const percent = Math.min(100, Math.floor((elapsed / total) * 100));
    return { total, extensions, percent, pending: Math.max(0, total - elapsed) };
};

/* =========================================================
   Single session
   ========================================================= */
function SingleSessionLayout({ session, now }) {
    const elapsed = session.startedAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000))
        : 0;
    const base = session.estimatedSeconds > 0 ? session.estimatedSeconds : BASE_SECONDS;
    const { total, extensions, percent, pending } = getProgress(elapsed, base);
    const imgUrl = session.image ? buildImageUrl(session.image) : "";
    const ringColor = "#22c55e";

    return (
        <div className="w-full max-w-[1500px] grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr_minmax(0,340px)] gap-8 lg:gap-10 items-center">
            <figure className="mx-auto w-full max-w-[340px]">
                <div className="relative aspect-square rounded-3xl overflow-hidden border border-[#f1cf8a]/40 shadow-[0_20px_60px_rgba(0,0,0,.6)]">
                    {imgUrl ? (
                        <img src={imgUrl} alt={session.itemName || `${B.Item}`} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full grid place-items-center bg-white/5 text-[#8a6d53]">No image</div>
                    )}
                </div>
                <figcaption className="mt-4 text-center">
                    <div className="text-xs text-[#a88b6f]">
                        {session.isCustom ? `${B.Custom}` : session.isGroupMember ? `Member's ${B.item}` : "Working on"}
                    </div>
                    <div className="serif text-2xl font-semibold">{session.itemName || `${B.Item}`}</div>
                </figcaption>
            </figure>

            <div className="flex flex-col items-center text-center gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#a88b6f]">
                    <Ticket size={18} className="text-[#f1cf8a]" /> Now serving
                </div>
                <span className="serif text-[#f1cf8a] font-bold leading-none text-[8rem] md:text-[11rem] xl:text-[14rem] drop-shadow-[0_0_60px_rgba(241,207,138,0.5)]">
                    #{session.tokenNumber}
                </span>
                <div className="serif text-3xl md:text-5xl font-semibold text-[#e9dccb]">{session.username}</div>

                {session.isGroupMember && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#f1cf8a]/30 bg-[#f1cf8a]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.2em] text-[#f1cf8a]">
                        <Users size={13} /> Group · {session.groupOwner}
                    </div>
                )}
                {session.isCustom && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#f1cf8a]/40 bg-[#f1cf8a]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.2em] text-[#f1cf8a]">
                        <Palette size={13} /> {B.Custom}
                    </div>
                )}

                {session.startedAt && (
                    <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-[#1d7a3e]/40 bg-[#1d7a3e]/10 px-5 py-3">
                        <span className="relative flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-70" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#4ade80]" />
                        </span>
                        <Timer size={22} className="text-[#4ade80]" />
                        <div className="text-left">
                            <div className="text-xs text-[#4ade80]/80">Session time</div>
                            <div className="serif text-3xl font-bold tabular-nums text-[#4ade80] leading-none">{formatTimer(elapsed)}</div>
                        </div>
                    </div>
                )}
            </div>

            <figure className="mx-auto w-full max-w-[340px]">
                <div className="relative aspect-square rounded-3xl overflow-hidden border shadow-[0_20px_60px_rgba(0,0,0,.6)]"
                    style={{ borderColor: `${ringColor}66` }} role="img" aria-label={`${percent}% complete`}>
                    {imgUrl && (
                        <>
                            <img src={imgUrl} alt="" className="absolute inset-0 h-full w-full object-cover grayscale brightness-[.4]" />
                            <div className="absolute inset-0 bg-red-600/35" />
                            <img src={imgUrl} alt=""
                                className="absolute inset-0 h-full w-full object-cover transition-[clip-path] duration-1000 ease-linear"
                                style={{ clipPath: `inset(${100 - percent}% 0 0 0)` }} />
                            <div className="absolute inset-0 bg-green-500/15 transition-[clip-path] duration-1000 ease-linear"
                                style={{ clipPath: `inset(${100 - percent}% 0 0 0)` }} />
                            <div className="absolute inset-x-0 h-[2px] transition-[top] duration-1000 ease-linear"
                                style={{ top: `${100 - percent}%`, background: ringColor, boxShadow: `0 0 14px ${ringColor}` }} />
                        </>
                    )}
                    <div className="absolute inset-0 grid place-items-center bg-black/25">
                        <div className="serif font-bold tabular-nums text-white text-7xl md:text-8xl drop-shadow-[0_4px_20px_rgba(0,0,0,.9)]">
                            {percent}<span className="text-4xl text-white/80">%</span>
                        </div>
                    </div>
                </div>

                <figcaption className="mt-4">
                    <div className="h-2.5 w-full rounded-full bg-red-500/70 overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${percent}%`, background: ringColor }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                        <div className="rounded-xl border border-[#4ade80]/25 bg-[#4ade80]/5 py-2">
                            <div className="text-xs text-[#4ade80]/80">Completed</div>
                            <div className="serif text-2xl font-bold tabular-nums text-[#4ade80]">{formatTimer(elapsed)}</div>
                        </div>
                        <div className="rounded-xl border border-red-500/35 bg-red-500/10 py-2">
                            <div className="text-xs text-red-300/90">Pending</div>
                            <div className="serif text-2xl font-bold tabular-nums text-red-400">{formatTimer(pending)}</div>
                        </div>
                    </div>
                    <div className="mt-3 text-center text-xs text-[#a88b6f]">
                        {extensions > 0
                            ? `Extended by ${extensions * 10} min · now ${Math.round(total / 60)} min total`
                            : `Estimated ${Math.round(total / 60)} min`}
                    </div>
                </figcaption>
            </figure>
        </div>
    );
}

/* =========================================================
   Multi session
   ========================================================= */
function CompactSessionCard({ session, now }) {
    const elapsed = session.startedAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000))
        : 0;
    const base = session.estimatedSeconds > 0 ? session.estimatedSeconds : BASE_SECONDS;
    const { total, extensions, percent } = getProgress(elapsed, base);
    const imgUrl = session.image ? buildImageUrl(session.image) : "";

    return (
        <div className="rounded-3xl border border-[#f1cf8a]/30 bg-white/[0.03] p-5 md:p-6 flex flex-col md:flex-row gap-5 md:gap-6">
            <div className="shrink-0">
                <div className="relative aspect-square w-full md:w-44 rounded-2xl overflow-hidden border border-[#f1cf8a]/30 shadow-[0_10px_40px_rgba(0,0,0,.5)]">
                    {imgUrl ? (
                        <img src={imgUrl} alt={session.itemName || `${B.Item}`} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full grid place-items-center bg-white/5 text-[#8a6d53] text-xs">No image</div>
                    )}
                </div>
                <div className="mt-2 text-center text-[10px] uppercase tracking-[.2em] text-[#a88b6f]">
                    {session.isCustom ? "Custom" : session.isGroupMember ? "Group" : "Working on"}
                </div>
                <div className="text-center serif text-base font-semibold">{session.itemName || `${B.Item}`}</div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#a88b6f]">
                    <Ticket size={14} className="text-[#f1cf8a]" /> Now serving
                </div>

                <div className="flex items-baseline gap-4 flex-wrap">
                    <span className="serif text-[#f1cf8a] font-bold leading-none text-6xl md:text-7xl drop-shadow-[0_0_40px_rgba(241,207,138,0.5)]">
                        #{session.tokenNumber}
                    </span>
                    <span className="serif text-2xl md:text-3xl font-semibold text-[#e9dccb] truncate">
                        {session.username}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {session.isGroupMember && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#f1cf8a]/30 bg-[#f1cf8a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#f1cf8a]">
                            <Users size={11} /> Group · {session.groupOwner}
                        </span>
                    )}
                    {session.isCustom && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#f1cf8a]/40 bg-[#f1cf8a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#f1cf8a]">
                            <Palette size={11} /> Custom
                        </span>
                    )}
                </div>

                {session.startedAt && (
                    <div className="inline-flex items-center gap-3 rounded-xl border border-[#1d7a3e]/40 bg-[#1d7a3e]/10 px-4 py-2 w-fit">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
                        </span>
                        <Timer size={16} className="text-[#4ade80]" />
                        <span className="serif text-2xl font-bold tabular-nums text-[#4ade80] leading-none">{formatTimer(elapsed)}</span>
                    </div>
                )}

                <div>
                    <div className="h-2 w-full rounded-full bg-red-500/40 overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                            style={{ width: `${percent}%`, background: "#22c55e" }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-[#a88b6f]">
                        <span>{percent}% complete</span>
                        <span>
                            {extensions > 0
                                ? `Extended · ${Math.round(total / 60)} min total`
                                : `Est. ${Math.round(total / 60)} min`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MultiSessionLayout({ sessions, now }) {
    const gridCols = sessions.length === 2
        ? "lg:grid-cols-2"
        : sessions.length === 3
            ? "lg:grid-cols-3"
            : "lg:grid-cols-2";

    return (
        <div className="w-full max-w-[1500px] mx-auto">
            <div className={`grid grid-cols-1 ${gridCols} gap-5 md:gap-6`}>
                {sessions.map((s) => (
                    <CompactSessionCard key={`${s.tokenNumber}-${s.username}`} session={s} now={now} />
                ))}
            </div>
            <div className="mt-4 text-center text-xs uppercase tracking-[.24em] text-[#a88b6f]">
                {sessions.length} sessions in progress
            </div>
        </div>
    );
}

/* =========================================================
   Main MonitorPage
   ========================================================= */
export default function MonitorPage({ eventId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [connected, setConnected] = useState(true);
    const [now, setNow] = useState(new Date());

    /* ---------- Clock ---------- */
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    /* ---------- Screen Wake Lock ---------- */
    useEffect(() => {
        let wakeLock = null;
        let cancelled = false;
        const requestWakeLock = async () => {
            try {
                if ("wakeLock" in navigator) {
                    const lock = await navigator.wakeLock.request("screen");
                    if (cancelled) { lock.release().catch(() => { }); return; }
                    wakeLock = lock;
                }
            } catch (err) {
                console.warn("Wake Lock failed:", err.message);
            }
        };
        requestWakeLock();
        const onVisible = () => { if (document.visibilityState === "visible") requestWakeLock(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", onVisible);
            wakeLock?.release?.().catch(() => { });
        };
    }, []);

    /* ---------- Sound ---------- */
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try { return localStorage.getItem("mehndi-monitor-sound") === "on"; }
        catch { return false; }
    });
    const [soundBlocked, setSoundBlocked] = useState(false);
    const effectiveSound = soundEnabled && !soundBlocked;

    const toggleSound = () => {
        if (soundBlocked) { setSoundBlocked(false); return; }
        setSoundEnabled((prev) => {
            const next = !prev;
            try { localStorage.setItem("mehndi-monitor-sound", next ? "on" : "off"); } catch { /* silent */ }
            return next;
        });
    };

    /* ---------- Fullscreen ---------- */
    const [isFullscreen, setIsFullscreen] = useState(false);
    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => { });
    };
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        const onKey = (e) => {
            if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
        };
        document.addEventListener("fullscreenchange", onChange);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("fullscreenchange", onChange);
            window.removeEventListener("keydown", onKey);
        };
    }, []);

    /* ---------- Queue polling ---------- */
    useEffect(() => {
        if (!eventId) { setError("No event specified. Add ?event=ID to the URL."); return; }
        let cancelled = false;
        const fetchQueue = async () => {
            try {
                const res = await api.get(`/api/events/${eventId}/queue`);
                if (cancelled) return;
                setData(res.data); setError(""); setConnected(true);
            } catch (err) {
                if (cancelled) return;
                setConnected(false);
                setError(err.response?.data?.message || "Failed to load queue");
            }
        };
        fetchQueue();
        const t = setInterval(fetchQueue, 8000);
        return () => { cancelled = true; clearInterval(t); };
    }, [eventId]);

    const sessions = data?.nowServing || [];
    const hasSession = sessions.length > 0;

    /* ---------- Ads ---------- */
    const { playingAd, markStarted, endPlayingAd } = useAdScheduler({ eventId, hasSession });

    /* ---------- FORCE AD TO END AT EXACTLY 60 SECONDS ---------- */
    // This effect runs every second (because `now` updates). If the admin set the
    // duration to 60s, this will force the ad to end at exactly 60s, even if the
    // YouTube video is 5 minutes long.
    useEffect(() => {
        if (!playingAd || !playingAd.started) return;
        const elapsedMs = now.getTime() - playingAd.startedAt;
        const totalMs = (playingAd.durationSeconds || 30) * 1000;
        if (elapsedMs >= totalMs) {
            endPlayingAd(true);
        }
    }, [now, playingAd, endPlayingAd]);

    /* ---------- Early returns ---------- */
    if (!eventId) {
        return (
            <div className="min-h-screen bg-[#120a06] grid place-items-center px-5">
                <div className="text-center">
                    <Sparkles size={48} className="mx-auto mb-4 text-[#f1cf8a]" />
                    <h1 className="serif text-3xl font-bold text-white">No event selected</h1>
                    <p className="mt-2 text-[#d9c9b8]">
                        Add <code className="bg-white/10 px-2 py-1 rounded">?event=event-xxxxx</code> to the URL.
                    </p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#120a06] grid place-items-center px-5">
                <div className="flex flex-col items-center gap-4 text-center">
                    {error ? (
                        <>
                            <WifiOff size={44} className="text-red-400" />
                            <div className="serif text-2xl text-red-300">{error}</div>
                            <div className="text-sm text-[#a88b6f]">Retrying every 8 seconds…</div>
                        </>
                    ) : (
                        <>
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#f1cf8a]/20 border-t-[#f1cf8a]" />
                            <div className="serif text-2xl text-[#f1cf8a]">Loading queue…</div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const upNext = data.upNext || [];
    const recentlyCompleted = data.recentlyCompleted || [];

    /* ---------- Ad view with countdown ---------- */
    if (playingAd) {
        const total = playingAd.durationSeconds || 30;
        const adRemaining = playingAd.started
            ? Math.max(0, Math.ceil(total - (now.getTime() - playingAd.startedAt) / 1000))
            : total;

        return (
            <div className="fixed inset-0 bg-black text-white">
                <AdPlayer
                    key={playingAd.runId}
                    video={playingAd.video}
                    soundEnabled={effectiveSound}
                    onStarted={markStarted}
                    onEnded={endPlayingAd}
                    onSoundBlocked={() => setSoundBlocked(true)}
                />

                {/* Floating Sound Toggle Button */}
                <button
                    type="button"
                    onClick={toggleSound}
                    className="absolute left-6 top-6 md:left-10 md:top-10 z-[200] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50 text-[#f1cf8a] transition hover:bg-white/10"
                    title={effectiveSound ? "Mute ads" : "Enable sound"}
                >
                    {effectiveSound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>

                {/* Top-right countdown */}
                <div className="absolute right-6 top-6 md:right-10 md:top-10 z-20">
                    <div className="relative grid h-24 w-24 md:h-32 md:w-32 place-items-center rounded-full border-4 border-[#f1cf8a]/40 bg-black/70 backdrop-blur-md shadow-[0_0_40px_rgba(241,207,138,0.35)]">
                        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                            <circle
                                cx="50" cy="50" r="44"
                                fill="none"
                                stroke="#f1cf8a"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 44}`}
                                strokeDashoffset={`${2 * Math.PI * 44 * (1 - adRemaining / total)}`}
                                style={{ transition: "stroke-dashoffset 1s linear" }}
                            />
                        </svg>
                        <div className="text-center">
                            <div className="serif text-4xl md:text-6xl font-bold text-[#f1cf8a] tabular-nums leading-none">
                                {adRemaining}
                            </div>
                            <div className="mt-1 text-[9px] md:text-[10px] uppercase tracking-[.24em] text-[#a88b6f]">
                                sec
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-5 md:p-8 pointer-events-none">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="rounded-full bg-[#f1cf8a]/20 border border-[#f1cf8a]/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.24em] text-[#f1cf8a]">
                                Ad
                            </span>
                            <div className="min-w-0">
                                <div className="serif truncate text-xl font-semibold text-white">{playingAd.campaign.advertiserName}</div>
                                {playingAd.video?.title && (
                                    <div className="text-xs text-[#d9c9b8] truncate">
                                        {playingAd.video.title}
                                        {playingAd.campaign.campaignTitle ? ` · ${playingAd.campaign.campaignTitle}` : ""}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {upNext.length > 0 && (
                                <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-[.24em] text-[#8a6d53]">Up next</div>
                                    <div className="mt-0.5 text-base font-semibold text-white">
                                        {upNext.slice(0, 4).map((t) => `#${t.tokenNumber}`).join(" · ")}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- Normal view ---------- */
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

    return (
        <div className="min-h-screen bg-[#120a06] text-white relative overflow-hidden">
            {/* Floating Sound Toggle Button */}
            <button
                type="button"
                onClick={toggleSound}
                className="fixed top-24 right-6 md:right-10 z-[200] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50 text-[#f1cf8a] transition hover:bg-white/10"
                title={effectiveSound ? "Mute ads" : "Enable sound"}
            >
                {effectiveSound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(#f1cf8a 1.5px, transparent 1.5px)", backgroundSize: "36px 36px" }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[600px] bg-[#f1cf8a]/5 blur-[160px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col min-h-screen">
                <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#24170f] to-[#382419] text-[#f1cf8a] serif text-xl ring-1 ring-[#f1cf8a]/30">M</div>
                        <div>
                            <div className="serif text-lg font-bold leading-tight">{B.name}</div>
                            <div className="text-xs text-[#8a6d53]">Live queue</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${connected ? "border-[#1d7a3e]/40 bg-[#1d7a3e]/10 text-[#4ade80]" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
                            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span className="hidden sm:inline">{connected ? "Live" : "Reconnecting"}</span>
                        </div>
                        <button type="button" onClick={toggleFullscreen}
                            title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-[#f1cf8a] transition hover:bg-white/10">
                            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                        </button>
                        <div className="text-right">
                            <div className="flex items-center gap-2 text-2xl md:text-3xl font-bold tabular-nums text-[#f1cf8a] leading-none">
                                <Clock size={22} /> {timeStr}
                            </div>
                            <div className="text-xs text-[#8a6d53] mt-1">{dateStr}</div>
                        </div>
                    </div>
                </header>

                <div className="text-center pt-8 pb-4 px-6">
                    <h1 className="serif text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-[#d9c9b8] leading-tight">
                        {data.event?.name}
                    </h1>
                </div>

                <div className="flex-1 grid place-items-center px-6 md:px-10 py-6">
                    {sessions.length === 0 ? (
                        <div className="text-center">
                            <div className="serif text-6xl md:text-8xl font-bold text-[#f1cf8a]/40">Waiting…</div>
                            <div className="mt-3 text-lg text-[#a88b6f]">
                                {data.totalTokens > 0 ? "Please wait for the next token" : "No orders yet"}
                            </div>
                        </div>
                    ) : sessions.length === 1 ? (
                        <SingleSessionLayout session={sessions[0]} now={now} />
                    ) : (
                        <MultiSessionLayout sessions={sessions} now={now} />
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 px-6 md:px-10 pb-8">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f1cf8a]/15 text-[#f1cf8a]"><Users size={19} /></div>
                            <h2 className="serif text-xl font-bold">Up next</h2>
                            <div className="ml-auto rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-[#d9c9b8]">
                                {upNext.length} waiting
                            </div>
                        </div>
                        {upNext.length === 0 ? (
                            <div className="py-10 text-center text-sm text-[#8a6d53]">No one in the queue</div>
                        ) : (
                            <div className="grid gap-3">
                                {upNext.map((t, i) => (
                                    <div key={t.tokenNumber} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                                        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${i === 0 ? "bg-[#f1cf8a]/20 text-[#f1cf8a] border border-[#f1cf8a]/40" : "bg-white/5 text-[#d9c9b8] border border-white/10"}`}>
                                            <span className="serif text-2xl font-bold tabular-nums">{t.tokenNumber}</span>
                                        </div>
                                        {t.image && (
                                            <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-white/10">
                                                <img src={buildImageUrl(t.image)} alt="" className="h-full w-full object-cover" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-base font-semibold">{t.username}</div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {t.isGroupMember && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f1cf8a]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f1cf8a]">
                                                        <Users size={10} /> Group · {t.groupOwner}
                                                    </span>
                                                )}
                                                {t.isCustom && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f1cf8a]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f1cf8a]">
                                                        <Palette size={10} /> Custom
                                                    </span>
                                                )}
                                                {i === 0 && (
                                                    <span className="text-xs font-semibold text-[#f1cf8a]">Next in line</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#1d7a3e]/20 text-[#4ade80]"><CheckCircle2 size={19} /></div>
                            <h2 className="serif text-xl font-bold">Recently completed</h2>
                            <div className="ml-auto rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-[#d9c9b8]">
                                {recentlyCompleted.length} done
                            </div>
                        </div>
                        {recentlyCompleted.length === 0 ? (
                            <div className="py-10 text-center text-sm text-[#8a6d53]">No completed tokens yet</div>
                        ) : (
                            <div className="grid gap-3">
                                {recentlyCompleted.map((t) => (
                                    <div key={t.tokenNumber} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 opacity-80">
                                        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#1d7a3e]/15 text-[#4ade80] border border-[#1d7a3e]/30">
                                            <span className="serif text-2xl font-bold tabular-nums">{t.tokenNumber}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-base font-semibold text-[#d9c9b8]">{t.username}</div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#4ade80]">
                                                <CheckCircle2 size={12} /> Done
                                                {t.durationSeconds > 0 && <span className="text-[#8a6d53]">{formatTimer(t.durationSeconds)}</span>}
                                                {t.isGroupMember && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f1cf8a]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f1cf8a]">
                                                        <Users size={10} /> Group · {t.groupOwner}
                                                    </span>
                                                )}
                                                {t.isCustom && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f1cf8a]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f1cf8a]">
                                                        <Palette size={10} /> Custom
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <footer className="border-t border-white/5 px-6 md:px-10 py-4 flex items-center justify-between text-xs text-[#8a6d53]">
                    <div>Total tokens: <span className="text-[#f1cf8a] font-bold">{data.totalTokens}</span></div>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
                        </span>
                        Refreshes every 8 seconds
                    </div>
                </footer>
            </div>
        </div>
    );
}