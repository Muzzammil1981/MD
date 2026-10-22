import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const EVAL_EVERY_MS = 2000;
const ADS_POLL_MS = 30_000;
const LOAD_TIMEOUT_MS = 15_000;
const OVERRUN_GRACE_S = 20;
const BAD_VIDEO_COOLDOWN_MS = 10 * 60_000;
const START_RETRY_MS = 10_000;
const ROTATION_KEY = "mehndi-monitor-ad-rotation";

const isUnlimited = (v) =>
    v.purchasedPlays == null || v.purchasedPlays === "N" || v.purchasedPlays === Infinity;

const isPlayable = (v) => {
    if (isUnlimited(v)) return true;
    const delivered = (v.playsCompleted || 0) + (v.playsInterrupted || 0);
    return delivered < (Number(v.purchasedPlays) || 0);
};

const loadRotation = (eventId) => {
    try { return JSON.parse(localStorage.getItem(`${ROTATION_KEY}:${eventId}`)) || {}; }
    catch { return {}; }
};
const saveRotation = (eventId, data) => {
    try { localStorage.setItem(`${ROTATION_KEY}:${eventId}`, JSON.stringify(data)); } catch { /* silent */ }
};

export default function useAdScheduler({ eventId, hasSession }) {
    const [playingAd, setPlayingAd] = useState(null);

    const adsRef = useRef([]);
    const playingAdRef = useRef(null);
    const hasSessionRef = useRef(hasSession);
    const startingRef = useRef(false);
    const endedRunRef = useRef(null);
    const aliveRef = useRef(true);
    const lastFailAtRef = useRef(0);
    const lastPlayAtRef = useRef({});
    const lastGlobalAdAtRef = useRef(0);
    const badVideosRef = useRef({});
    const rotationRef = useRef(null);
    if (rotationRef.current === null) rotationRef.current = loadRotation(eventId);

    hasSessionRef.current = hasSession;

    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    const fetchAds = useCallback(async () => {
        if (!eventId) return;
        try {
            const { data } = await api.get(`/api/ads/active?eventId=${eventId}`);
            if (aliveRef.current) adsRef.current = Array.isArray(data) ? data : [];
        } catch { /* keep the previous list */ }
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return;
        fetchAds();
        const t = setInterval(fetchAds, ADS_POLL_MS);
        return () => clearInterval(t);
    }, [eventId, fetchAds]);

    const pickNextVideo = useCallback((campaign) => {
        const vids = campaign.videos || [];
        if (!vids.length) return null;
        const lastIdx = vids.findIndex((v) => v.id === rotationRef.current[campaign.id]);
        const nowMs = Date.now();
        for (let i = 1; i <= vids.length; i++) {
            const v = vids[(lastIdx + i) % vids.length];
            const badUntil = badVideosRef.current[v.id] || 0;
            if (isPlayable(v) && badUntil <= nowMs) return v;
        }
        return null;
    }, []);

    const tryStartNext = useCallback(async () => {
        if (!aliveRef.current || playingAdRef.current || startingRef.current) return;
        const nowMs = Date.now();
        if (nowMs - lastFailAtRef.current < START_RETRY_MS) return;

        const sessionActive = hasSessionRef.current;
        const eligible = adsRef.current.filter((a) => {
            if (!a.active || a.exhausted || !a.videos?.length) return false;
            const intervalMs = (a.intervalMinutes || 0) * 60_000;
            const ownLast = lastPlayAtRef.current[a.id] || 0;
            switch (a.playMode) {
                case "no-session": return !sessionActive;
                case "interval": return nowMs - lastGlobalAdAtRef.current >= intervalMs;
                case "no-session-and-interval": return !sessionActive && nowMs - ownLast >= intervalMs;
                default: return false;
            }
        });
        if (!eligible.length) return;

        eligible.sort((a, b) => (lastPlayAtRef.current[a.id] || 0) - (lastPlayAtRef.current[b.id] || 0));

        for (const campaign of eligible) {
            const video = pickNextVideo(campaign);
            if (!video) continue;

            startingRef.current = true;
            try {
                const { data: run } = await api.post(`/api/ads/${campaign.id}/run-start`, { videoId: video.id });
                if (!aliveRef.current) return;

                const ts = Date.now();
                rotationRef.current[campaign.id] = video.id;
                saveRotation(eventId, rotationRef.current);
                lastPlayAtRef.current[campaign.id] = ts;
                lastGlobalAdAtRef.current = ts;

                const ad = {
                    campaign,
                    video: { ...video, embedUrl: video.embedUrl || video.url },
                    runId: run.runId,
                    started: false,
                    startedAt: ts,
                    // THIS IS THE ADMIN-CONFIGURED DURATION (e.g. 60s)
                    durationSeconds: Number(video.durationSeconds) || 30,
                };
                playingAdRef.current = ad;
                setPlayingAd(ad);
            } catch {
                lastFailAtRef.current = Date.now();
            } finally {
                startingRef.current = false;
            }
            return;
        }
    }, [eventId, pickNextVideo]);

    useEffect(() => {
        const t = setInterval(tryStartNext, EVAL_EVERY_MS);
        const first = setTimeout(tryStartNext, 1500);
        return () => { clearInterval(t); clearTimeout(first); };
    }, [tryStartNext]);

    const endPlayingAd = useCallback((completed, reason) => {
        const ad = playingAdRef.current;
        if (!ad || endedRunRef.current === ad.runId) return;
        endedRunRef.current = ad.runId;
        playingAdRef.current = null;
        setPlayingAd(null);

        const failed = reason === "error";
        if (failed) badVideosRef.current[ad.video.id] = Date.now() + BAD_VIDEO_COOLDOWN_MS;

        if (!failed) {
            adsRef.current = adsRef.current.map((a) =>
                a.id !== ad.campaign.id ? a : {
                    ...a,
                    videos: (a.videos || []).map((v) =>
                        v.id !== ad.video.id ? v : {
                            ...v,
                            playsCompleted: (v.playsCompleted || 0) + (completed ? 1 : 0),
                            playsInterrupted: (v.playsInterrupted || 0) + (completed ? 0 : 1),
                        }),
                });
        }

        tryStartNext();

        api.post(`/api/ads/${ad.campaign.id}/run-end`, {
            runId: ad.runId,
            completed: Boolean(completed),
            reason: failed ? "error" : undefined,
        })
            .catch(() => { /* silent */ })
            .finally(fetchAds);
    }, [fetchAds, tryStartNext]);

    const markStarted = useCallback(({ duration } = {}) => {
        const ad = playingAdRef.current;
        if (!ad || ad.started) return;

        // FIXED: We DO NOT overwrite durationSeconds with the YouTube duration.
        // We strictly use the admin's configured duration (e.g. 60s).
        const next = {
            ...ad,
            started: true,
            startedAt: Date.now(),
            durationSeconds: ad.durationSeconds,
        };
        playingAdRef.current = next;
        setPlayingAd(next);
    }, []);

    useEffect(() => {
        if (!playingAd) return;
        const started = playingAd.started;
        const ms = started
            ? (playingAd.durationSeconds + OVERRUN_GRACE_S) * 1000
            : LOAD_TIMEOUT_MS;
        const t = setTimeout(() => {
            if (started) endPlayingAd(true);
            else endPlayingAd(false, "error");
        }, ms);
        return () => clearTimeout(t);
    }, [playingAd?.runId, playingAd?.started, playingAd?.durationSeconds, endPlayingAd]);

    return { playingAd, markStarted, endPlayingAd };
}