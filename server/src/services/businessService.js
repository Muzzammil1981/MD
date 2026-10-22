import QRCode from "qrcode";
import { query } from "../db/pool.js";
import { INDUSTRIES, getProfile } from "../config/industries.js";

/* =========================================================
   Businesses = industries that have their own public address:  https://site/<slug>
   ========================================================= */
const RESERVED = new Set([
    "admin", "api", "monitor", "uploads", "assets", "static", "login", "register", "directory", "businesses",
    "health", "favicon.ico", "robots.txt", "sitemap.xml", "index.html", "business", "events", "orders",
]);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
export const toSlug = (s) => String(s).toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

/* ---- in-memory index (slug <-> key), refreshed after every change ---- */
let bySlug = new Map();   // slug -> { key, published }
let byKey = new Map();    // key  -> { slug, published, sortOrder }

export async function refreshBusinessIndex() {
    const rows = await query(`SELECT * FROM mehndi.IndustrySettings`);
    bySlug = new Map(rows.map((r) => [r.Slug, { key: r.IndustryKey, published: r.Published === true }]));
    byKey = new Map(rows.map((r) => [r.IndustryKey, { slug: r.Slug, published: r.Published === true, sortOrder: r.SortOrder }]));
}

export const resolveSlug = (slug) => bySlug.get(String(slug || "").toLowerCase()) || null;
export const slugOf = (key) => byKey.get(key)?.slug || null;
export const settingsOf = (key) => byKey.get(key) || { slug: key, published: false, sortOrder: 0 };

/** Make sure every industry (built-in + custom) has an address row and a schedule row. Runs on start. */
export async function ensureIndustryRows(defaultKey) {
    const custom = await query(`SELECT IndustryKey, Name FROM mehndi.Industries`);
    const all = [...Object.keys(INDUSTRIES), ...custom.map((r) => r.IndustryKey)];
    const have = new Set((await query(`SELECT IndustryKey FROM mehndi.IndustrySettings`)).map((r) => r.IndustryKey));
    const used = new Set((await query(`SELECT Slug FROM mehndi.IndustrySettings`)).map((r) => r.Slug));

    let order = (await query(`SELECT ISNULL(MAX(SortOrder), 0) AS M FROM mehndi.IndustrySettings`))[0].M;
    for (const key of all) {
        if (!have.has(key)) {
            let slug = toSlug(key.startsWith("c-") ? key.slice(2) : key) || "business";
            for (let i = 2; used.has(slug) || RESERVED.has(slug); i++) slug = `${toSlug(key).slice(0, 36)}-${i}`;
            used.add(slug);
            // an industry that already has categories (or is the default one) is in use → published
            const hasCats = (await query(`SELECT COUNT(*) AS N FROM mehndi.Categories WHERE IndustryKey = @k`, { k: key }))[0].N > 0;
            await query(
                `INSERT INTO mehndi.IndustrySettings (IndustryKey, Slug, Published, SortOrder) VALUES (@k, @s, @p, @o)`,
                { k: key, s: slug, p: hasCats || key === defaultKey, o: ++order });
        }
        // each business gets its own opening hours, starting from the old single schedule
        await query(
            `IF NOT EXISTS (SELECT 1 FROM mehndi.IndustrySchedule WHERE IndustryKey = @k)
                 INSERT INTO mehndi.IndustrySchedule (IndustryKey, OpenTime, CloseTime, SlotMinutes, Stations, ClosedDays, AdvanceDays)
                 SELECT @k, OpenTime, CloseTime, SlotMinutes, Stations, ClosedDays, AdvanceDays FROM mehndi.ScheduleSettings WHERE Id = 1`,
            { k: key });
    }
    await refreshBusinessIndex();
}

/** A new (custom) industry gets its own address row. */
export async function createBusinessRow(key, name) {
    let slug = toSlug(name) || toSlug(key);
    for (let i = 2; bySlug.has(slug) || RESERVED.has(slug); i++) slug = `${toSlug(name).slice(0, 36)}-${i}`;
    const order = (await query(`SELECT ISNULL(MAX(SortOrder), 0) + 1 AS N FROM mehndi.IndustrySettings`))[0].N;
    await query(`INSERT INTO mehndi.IndustrySettings (IndustryKey, Slug, Published, SortOrder) VALUES (@k, @s, 0, @o)`, { k: key, s: slug, o: order });
    await query(
        `INSERT INTO mehndi.IndustrySchedule (IndustryKey, OpenTime, CloseTime, SlotMinutes, Stations, ClosedDays, AdvanceDays)
         SELECT @k, OpenTime, CloseTime, SlotMinutes, Stations, ClosedDays, AdvanceDays FROM mehndi.ScheduleSettings WHERE Id = 1`, { k: key });
    await refreshBusinessIndex();
    return slug;
}

export async function deleteBusinessRow(key) {
    await query(`DELETE FROM mehndi.IndustrySettings WHERE IndustryKey = @k`, { k: key });
    await query(`DELETE FROM mehndi.IndustrySchedule WHERE IndustryKey = @k`, { k: key });
    await refreshBusinessIndex();
}

/** SuperAdmin: change a business's address and whether the public can see it. */
export async function updateAddress(key, { slug, published }) {
    const cur = byKey.get(key);
    if (!cur) throw fail("Business not found", 404);
    let next = cur.slug;
    if (slug !== undefined) {
        next = String(slug).trim().toLowerCase();
        if (next.length < 2 || next.length > 40 || !SLUG_RE.test(next)) throw fail("Address must be 2-40 characters: letters, numbers and single hyphens (e.g. hair-beauty)");
        if (RESERVED.has(next)) throw fail(`“${next}” is reserved. Choose another address.`);
        const clash = bySlug.get(next);
        if (clash && clash.key !== key) throw fail("That address is already used by another business");
    }
    await query(
        `UPDATE mehndi.IndustrySettings SET Slug = @s, Published = @p, UpdatedAt = SYSUTCDATETIME() WHERE IndustryKey = @k`,
        { k: key, s: next, p: published === undefined ? cur.published : Boolean(published) });
    await refreshBusinessIndex();
    return settingsOf(key);
}

/** Public directory: published businesses in the SuperAdmin's order. */
export async function listPublishedBusinesses() {
    const rows = await query(`SELECT * FROM mehndi.IndustrySettings WHERE Published = 1 ORDER BY SortOrder, Slug`);
    const out = [];
    for (const r of rows) {
        const p = getProfile(r.IndustryKey);
        const n = (await query(`SELECT COUNT(*) AS N FROM mehndi.Categories WHERE IndustryKey = @k`, { k: r.IndustryKey }))[0].N;
        out.push({ slug: r.Slug, name: p.name, tagline: p.tagline, kicker: p.heroKicker, categories: n });
    }
    return out;
}

export async function qrFor(url) {
    return QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: "M", color: { dark: "#24170f", light: "#fffdf9" } });
}
