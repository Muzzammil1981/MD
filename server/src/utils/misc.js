export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function mulberry32(seed) {
    let a = seed | 0;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function seededShuffle(arr, seed) {
    const a = [...arr];
    const rand = mulberry32(seed);
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Escape a user search token for use inside a T-SQL LIKE pattern. */
export const likeEscape = (s) => s.replace(/[\\%_\[]/g, (c) => `\\${c}`);

export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
