import { query } from "../db/pool.js";
import { invalidateCategories } from "./categoryService.js";
import { createBusinessRow, deleteBusinessRow, settingsOf } from "./businessService.js";
import {
    INDUSTRIES, INDUSTRY_NAMES, LABEL_GROUPS, LABEL_KEYS, LABEL_HINTS, buildProfile, setProfiles, getIndustryKey,
} from "../config/industries.js";

const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

/* key → { base: built-in profile, name } , for built-in and SuperAdmin-added industries */
async function resolveIndustry(key) {
    if (INDUSTRIES[key]) return { base: INDUSTRIES[key], name: INDUSTRY_NAMES[key], builtIn: true };
    const rows = await query(`SELECT * FROM mehndi.Industries WHERE IndustryKey = @k`, { k: key });
    if (!rows[0]) return null;
    return { base: INDUSTRIES[rows[0].BaseKey] || INDUSTRIES.mehndi, name: rows[0].Name, builtIn: false, baseKey: rows[0].BaseKey };
}

async function overridesFor(key) {
    const rows = await query(`SELECT LabelKey, Value FROM mehndi.IndustryLabels WHERE IndustryKey = @k`, { k: key });
    return Object.fromEntries(rows.map((r) => [r.LabelKey, r.Value]));
}

/** The DEFAULT business: the one used when a request names no business (old links, the monitor ...). */
export async function getDefaultKey() {
    const row = (await query(`SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1`))[0];
    const key = row?.ActiveIndustry || getIndustryKey();
    return (await resolveIndustry(key)) ? key : getIndustryKey();
}

/** Build the profile (template + SuperAdmin wording) of EVERY business and make them live. */
export async function refreshProfiles() {
    const defaultKey = await getDefaultKey();
    const customs = await query(`SELECT * FROM mehndi.Industries`);
    const labelRows = await query(`SELECT IndustryKey, LabelKey, Value FROM mehndi.IndustryLabels`);
    const overrides = new Map();
    for (const r of labelRows) {
        if (!overrides.has(r.IndustryKey)) overrides.set(r.IndustryKey, {});
        overrides.get(r.IndustryKey)[r.LabelKey] = r.Value;
    }

    const map = new Map();
    const add = (key, base) => {
        const own = overrides.get(key) || {};
        const env = {};
        if (key === defaultKey) {          // .env brand overrides only apply to the default business
            if (!own.name && (process.env.BRAND_NAME || "").trim()) env.name = process.env.BRAND_NAME.trim();
            if (!own.tagline && (process.env.BRAND_TAGLINE || "").trim()) env.tagline = process.env.BRAND_TAGLINE.trim();
        }
        map.set(key, buildProfile(key, base, { ...env, ...own }));
    };
    for (const [key, base] of Object.entries(INDUSTRIES)) add(key, base);
    for (const r of customs) add(r.IndustryKey, INDUSTRIES[r.BaseKey] || INDUSTRIES.mehndi);

    setProfiles(map, defaultKey);
    invalidateCategories();            // categories are per business
    return map.get(defaultKey);
}
export const refreshProfile = refreshProfiles;   // older name, same thing

export async function listIndustries() {
    const custom = await query(`SELECT * FROM mehndi.Industries ORDER BY CreatedAt`);
    const row = (await query(`SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1`))[0];
    return {
        active: row?.ActiveIndustry || getIndustryKey(),
        industries: [
            ...Object.keys(INDUSTRIES).map((k) => ({ key: k, name: INDUSTRY_NAMES[k], builtIn: true, ...settingsOf(k) })),
            ...custom.map((r) => ({ key: r.IndustryKey, name: r.Name, builtIn: false, baseKey: r.BaseKey, ...settingsOf(r.IndustryKey) })),
        ],
    };
}

export async function setActiveIndustry(key) {
    if (!(await resolveIndustry(key))) throw fail("Unknown industry");
    await query(`UPDATE mehndi.AppSettings SET ActiveIndustry = @k, UpdatedAt = SYSUTCDATETIME() WHERE Id = 1`, { k: key });
    return refreshProfile();
}

export async function createIndustry({ name, baseKey, createdBy }) {
    const clean = String(name || "").trim();
    if (clean.length < 2 || clean.length > 100) throw fail("Industry name must be 2-100 characters");
    if (!INDUSTRIES[baseKey]) throw fail("Choose a starting template");
    const key = `c-${slug(clean)}`;
    if (key === "c-" || (await resolveIndustry(key))) throw fail("An industry with that name already exists");
    await query(
        `INSERT INTO mehndi.Industries (IndustryKey, Name, BaseKey, CreatedBy) VALUES (@k, @n, @b, @c)`,
        { k: key, n: clean, b: baseKey, c: createdBy || null });
    // new industries start with the template's wording but their own shop name
    await query(
        `INSERT INTO mehndi.IndustryLabels (IndustryKey, LabelKey, Value) VALUES (@k, 'name', @n)`, { k: key, n: clean });
    const slug = await createBusinessRow(key, clean);      // its own address (not published until you say so)
    await refreshProfiles();
    return { key, name: clean, baseKey, builtIn: false, slug };
}

export async function deleteIndustry(key) {
    const info = await resolveIndustry(key);
    if (!info) throw fail("Industry not found", 404);
    if (info.builtIn) throw fail("Built-in industries cannot be deleted");
    const { active } = await listIndustries();
    if (active === key) throw fail("This industry is in use. Switch to another one first.");
    await query(`DELETE FROM mehndi.IndustryLabels WHERE IndustryKey = @k`, { k: key });
    await query(`DELETE FROM mehndi.Industries WHERE IndustryKey = @k`, { k: key });
    await deleteBusinessRow(key);
    await refreshProfiles();
    return { ok: true };
}

/** Everything the "edit wording" form needs: current values, which are customised, the form layout. */
export async function getEditable(key) {
    const info = await resolveIndustry(key);
    if (!info) throw fail("Industry not found", 404);
    const overrides = await overridesFor(key);
    const profile = buildProfile(key, info.base, overrides);
    const values = {};
    for (const k of LABEL_KEYS) values[k] = k === "amountTypes" ? (profile[k] || []).join("\n") : (profile[k] ?? "");
    return {
        key, name: info.name, builtIn: info.builtIn,
        groups: LABEL_GROUPS.map((g) => ({ title: g.title, fields: g.fields.map(([k, label, type]) => ({ key: k, label, type, hint: LABEL_HINTS[k] || "" })) })),
        values,
        customised: Object.keys(overrides).filter((k) => LABEL_KEYS.has(k)),
    };
}

export async function saveLabels(key, labels) {
    const info = await resolveIndustry(key);
    if (!info) throw fail("Industry not found", 404);

    for (const [k, raw] of Object.entries(labels || {})) {
        if (!LABEL_KEYS.has(k)) continue;
        let value = String(raw ?? "").trim();
        if (value.length > 2000) throw fail(`"${k}" is too long`);
        if (k === "amountTypes") {
            value = value.split(/\r?\n|\|/).map((x) => x.trim()).filter(Boolean).join("|");
            if (!value) throw fail("Add at least one price unit");
        } else if (!value) {
            throw fail("Fields cannot be empty - use Reset to go back to the template wording");
        }
        const baseValue = k === "amountTypes" ? (info.base[k] || []).join("|") : info.base[k];
        if (value === baseValue && !(k === "name")) {
            await query(`DELETE FROM mehndi.IndustryLabels WHERE IndustryKey=@i AND LabelKey=@k`, { i: key, k });   // same as template → no override needed
        } else {
            await query(
                `UPDATE mehndi.IndustryLabels SET Value=@v WHERE IndustryKey=@i AND LabelKey=@k;
                 IF @@ROWCOUNT = 0 INSERT INTO mehndi.IndustryLabels (IndustryKey, LabelKey, Value) VALUES (@i, @k, @v);`,
                { i: key, k, v: value });
        }
    }
    await refreshProfile();
    return getEditable(key);
}

export async function resetLabels(key) {
    if (!(await resolveIndustry(key))) throw fail("Industry not found", 404);
    await query(`DELETE FROM mehndi.IndustryLabels WHERE IndustryKey = @k`, { k: key });
    await refreshProfile();
    return getEditable(key);
}

/** The template's starter categories for an industry (built-in or custom). */
export async function starterCategoriesFor(key) {
    const info = await resolveIndustry(key);
    if (!info) throw fail("Industry not found", 404);
    return info.base.categories;
}

export async function industryExists(key) { return Boolean(await resolveIndustry(key)); }
