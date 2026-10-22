import { useEffect, useRef } from "react";

/* ---------------------------------------------------------
   YouTube IFrame API – loaded once, shared by every mount
   --------------------------------------------------------- */
let ytPromise = null;
function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (!ytPromise) {
        ytPromise = new Promise((resolve, reject) => {
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                previous?.();
                resolve(window.YT);
            };
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            tag.async = true;
            tag.onerror = () => {
                ytPromise = null; // allow a retry on the next ad
                reject(new Error("YouTube API failed to load"));
            };
            document.head.appendChild(tag);
        });
    }
    return ytPromise;
}

const getYouTubeId = (url = "") => {
    const m = url.match(
        /(?:youtube\.com\/(?:embed\/|shorts\/|live\/|v\/|watch\?(?:.*&)?v=)|youtu\.be\/)([\w-]{11})/
    );
    if (m) return m[1];
    return /^[\w-]{11}$/.test(url) ? url : null;
};

const userHasInteracted = () =>
    navigator.userActivation ? navigator.userActivation.hasBeenActive : false;

const isFileUrl = (url = "") => /\.(mp4|webm|ogg)(\?|$)/i.test(url);

/* ---------------------------------------------------------
   YouTube player
   --------------------------------------------------------- */
function YouTubePlayer({ videoId, soundEnabled, handlers }) {
    const hostRef = useRef(null);
    const playerRef = useRef(null);
    const handlersRef = useRef(handlers);
    const soundRef = useRef(soundEnabled);
    handlersRef.current = handlers;
    soundRef.current = soundEnabled;

    useEffect(() => {
        let disposed = false;
        let finished = false;
        let started = false;

        const finish = (completed, reason) => {
            if (finished || disposed) return;
            finished = true;
            handlersRef.current.onEnded?.(completed, reason);
        };

        // YT.Player REPLACES the element it is given with an <iframe>.
        // Give it a throw-away child so React's container survives destroy().
        const mount = document.createElement("div");
        hostRef.current.appendChild(mount);

        // Try to unmute; if the browser blocks it, fall back to muted playback.
        const applySound = (p) => {
            try {
                if (!soundRef.current) { p.mute(); return; }
                // Chrome/Edge pause the video if we unmute before any click on the page.
                // So don't even try until the user has interacted once.
                if (!userHasInteracted()) {
                    handlersRef.current.onSoundBlocked?.();
                    p.mute();
                    return;
                }
                p.unMute();
                setTimeout(() => {
                    if (disposed) return;
                    try {
                        const playing = p.getPlayerState() === window.YT.PlayerState.PLAYING;
                        if (!playing || p.isMuted()) {
                            p.mute();
                            p.playVideo();
                            handlersRef.current.onSoundBlocked?.();
                        }
                    } catch { /* player gone */ }
                }, 800);
            } catch { /* player gone */ }
        };

        loadYouTubeApi()
            .then((YT) => {
                if (disposed) return;
                playerRef.current = new YT.Player(mount, {
                    width: "100%",
                    height: "100%",
                    videoId,
                    host: "https://www.youtube-nocookie.com",
                    playerVars: {
                        autoplay: 1,
                        mute: 1, // must start muted for autoplay to be allowed
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        playsinline: 1,
                        rel: 0,
                        origin: window.location.origin,
                        enablejsapi: 1,
                    },
                    events: {
                        onReady: (e) => {
                            e.target.mute();
                            e.target.playVideo();
                        },
                        onStateChange: (e) => {
                            const S = YT.PlayerState;
                            if (e.data === S.PLAYING) {
                                if (!started) {
                                    started = true;
                                    handlersRef.current.onStarted?.({ duration: e.target.getDuration() });
                                    applySound(e.target);
                                }
                            } else if (e.data === S.ENDED) {
                                finish(true);
                            } else if (
                                e.data === S.PAUSED ||
                                e.data === S.CUED ||
                                e.data === S.UNSTARTED
                            ) {
                                // never stay paused / on the red play button
                                if (!userHasInteracted()) e.target.mute();
                                e.target.playVideo();
                            }
                        },
                        // Browser blocked autoplay – retry muted
                        onAutoplayBlocked: (e) => {
                            try { e.target.mute(); e.target.playVideo(); } catch { /* ignore */ }
                        },
                        // 2/5/100/101/150: bad id, unavailable, embedding disabled…
                        onError: () => finish(false, "error"),
                    },
                });
            })
            .catch(() => finish(false, "error"));

        // Stall watchdog. If the iframe is removed/replaced (Chrome "heavy ad"
        // intervention) or playback stops advancing, no YouTube event fires.
        // Detect it and fail fast so the rotation moves to the next video.
        let lastTime = -1;
        let stalledTicks = 0;
        const watchdog = setInterval(() => {
            if (disposed || finished || !started) return;
            const p = playerRef.current;
            try {
                const iframe = hostRef.current?.querySelector("iframe");
                if (!iframe || !iframe.isConnected) { finish(false, "error"); return; }
                const t = p.getCurrentTime();
                const st = p.getPlayerState();
                const buffering = st === window.YT.PlayerState.BUFFERING;
                if (t === lastTime && !buffering) stalledTicks++;
                else stalledTicks = 0;
                if (t === lastTime && buffering) stalledTicks += 0.5;
                lastTime = t;
                if (stalledTicks >= 5) finish(false, "error"); // ~10 s without progress
            } catch { finish(false, "error"); }
        }, 2000);

        return () => {
            disposed = true;
            clearInterval(watchdog);
            try { playerRef.current?.destroy(); } catch { /* ignore */ }
            playerRef.current = null;
            mount.remove();
            hostRef.current?.replaceChildren();
        };
    }, [videoId]);

    // Sound toggle (a click on the toggle is a user gesture, so unmute works)
    useEffect(() => {
        const p = playerRef.current;
        try {
            if (soundEnabled) p?.unMute?.();
            else p?.mute?.();
        } catch { /* not ready yet */ }
    }, [soundEnabled]);

    return (
        <div className="relative h-full w-full bg-black">
            <div ref={hostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
            {/* Blocks clicks so nobody can pause / open YouTube on the kiosk */}
            <div className="absolute inset-0 z-10" />
        </div>
    );
}

/* ---------------------------------------------------------
   Direct mp4 / webm
   --------------------------------------------------------- */
function FilePlayer({ src, soundEnabled, handlers }) {
    const ref = useRef(null);
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        const v = ref.current;
        if (!v) return;
        v.muted = !soundEnabled;
        v.play().catch(() => {
            // unmuted autoplay blocked → retry muted
            v.muted = true;
            if (soundEnabled) handlersRef.current.onSoundBlocked?.();
            v.play().catch(() => handlersRef.current.onEnded?.(false, "error"));
        });
    }, [soundEnabled, src]);

    return (
        <video
            ref={ref}
            src={src}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-contain bg-black pointer-events-none"
            onPlaying={(e) => handlersRef.current.onStarted?.({ duration: e.currentTarget.duration })}
            onEnded={() => handlersRef.current.onEnded?.(true)}
            onError={() => handlersRef.current.onEnded?.(false, "error")}
        />
    );
}

/* ---------------------------------------------------------
   Public component
   onStarted({duration})   – first frame is really playing
   onEnded(completed, reason) – finished (true) or failed (false, "error")
   onSoundBlocked()        – browser refused audio, playing muted
   --------------------------------------------------------- */
export default function AdPlayer({ video, soundEnabled = false, onStarted, onEnded, onSoundBlocked }) {
    const url = video?.embedUrl || video?.url || "";
    const file = isFileUrl(url);
    const ytId = file ? null : getYouTubeId(url);
    const handlers = { onStarted, onEnded, onSoundBlocked };

    // Unplayable source → fail immediately so the rotation moves on
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const unplayable = !file && !ytId;
    useEffect(() => {
        if (unplayable) onEndedRef.current?.(false, "error");
    }, [unplayable]);

    if (file) return <FilePlayer src={url} soundEnabled={soundEnabled} handlers={handlers} />;
    if (ytId) return <YouTubePlayer videoId={ytId} soundEnabled={soundEnabled} handlers={handlers} />;
    return <div className="h-full w-full bg-black" />;
}