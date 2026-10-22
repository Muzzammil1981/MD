let audioCtx = null;

function getCtx() {
    if (typeof window === "undefined") return null;
    if (!audioCtx) {
        try {
            const C = window.AudioContext || window.webkitAudioContext;
            if (!C) return null;
            audioCtx = new C();
        } catch { return null; }
    }
    return audioCtx;
}

/* Plays a short two-tone chime.
   kind = "info" | "success" | "error" */
export function playNotificationSound(kind = "info") {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => { });

    const tones =
        kind === "success" ? [660, 880] :
            kind === "error" ? [400, 260] :
                [784, 587];

    const now = ctx.currentTime;
    tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;

        const start = now + i * 0.13;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
    });
}

/* Browsers block audio until the user interacts with the page once.
   Call this once on app load — it resumes the AudioContext on the
   first click anywhere, so subsequent sounds play immediately. */
export function primeAudioOnFirstGesture() {
    const handler = () => {
        const ctx = getCtx();
        if (ctx && ctx.state === "suspended") ctx.resume().catch(() => { });
        window.removeEventListener("pointerdown", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
}