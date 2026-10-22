/* =====================================================================
   INDUSTRY PROFILES
   One codebase, many businesses. Pick one with  INDUSTRY=barber  in .env
   (mehndi | barber | salon | carwash). Optionally override the shop name with
   BRAND_NAME / BRAND_TAGLINE. Use ONE database per business.

   To add a new industry: copy a profile below, change the words and categories.
   ===================================================================== */

import { AsyncLocalStorage } from "node:async_hooks";
import { INDUSTRIES } from "../industries/index.js";
export { INDUSTRIES };

export const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/* Display names of the built-in industries (shown in the SuperAdmin picker) */
export const INDUSTRY_NAMES = {
    mehndi: "Mehndi studio",
    barber: "Barber shop",
    salon: "Hair & beauty salon",
    carwash: "Car wash / detailing",
};

/* Which wording the SuperAdmin may edit, and how the form is laid out */
export const LABEL_GROUPS = [
    { title: "Shop identity", fields: [
        ["name", "Shop name", "text"], ["tagline", "Tagline", "text"], ["footerTagline", "Footer line", "text"],
        ["metaDescription", "Search-engine description", "textarea"]] },
    { title: "Words used everywhere", fields: [
        ["item", "One item (singular)", "text"], ["items", "Items (plural)", "text"],
        ["custom", "Custom order (e.g. special request)", "text"], ["customRequest", "Custom request (longer)", "text"],
        ["amountTypes", "Price units (one per line)", "list"], ["defaultDescription", "Default item description", "text"]] },
    { title: "Home page", fields: [
        ["heroKicker", "Hero small title", "text"], ["heroTitle1", "Hero headline - line 1", "text"],
        ["heroTitle2", "Hero headline - line 2 (italic)", "text"], ["heroText", "Hero paragraph", "textarea"],
        ["heroBadge", "Hero badge", "text"], ["heroCardTitle", "Category count caption", "text"],
        ["heroArt", "Hero picture word", "text"], ["heroArtSub", "Hero picture sub-word", "text"],
        ["exploreLabel", "Explore button", "text"], ["allLabel", "'All' filter label", "text"],
        ["catalogKicker", "Catalogue small title", "text"], ["catalogTitle", "Catalogue heading", "text"],
        ["browseLabel", "Browse button", "text"],
        ["storyKicker", "Story small title", "text"], ["storyTitle", "Story heading", "text"],
        ["storyText", "Story paragraph", "textarea"],
        ["storyStat1", "Story stat 1 label", "text"], ["storyStat2", "Story stat 2 label", "text"], ["storyStat3", "Story stat 3 label", "text"]] },
    { title: "Messages", fields: [
        ["sessionStart", "Start-work button (admin)", "text"], ["startedTitle", "'Work started' notification", "text"],
        ["sessionWorking", "'Working on you' banner", "text"], ["readyTitle", "'Ready' message", "text"],
        ["readyGroup", "'Group ready' message", "text"], ["reviewPrompt", "Review question", "text"],
        ["reviewHint", "Review box hint", "text"], ["customPlaceholder", "Custom request example", "textarea"],
        ["eventSubtitle", "Event page sub-title", "text"]] },
];

/* What each wording field is for (shown in the editor and given to the AI prompt) */
export const LABEL_HINTS = {
    name: "Business name shown in the header, footer and messages (2-4 words).",
    tagline: "Short slogan under the name (max 6 words).",
    footerTagline: "One short line in the website footer.",
    metaDescription: "1-2 sentences for Google search results (max 160 characters).",
    item: "What a customer books, singular, lowercase (e.g. dish, service, package).",
    items: "Plural of item, lowercase.",
    custom: "Name of a custom order, lowercase (e.g. special order).",
    customRequest: "Longer form of the custom order name (e.g. special order request).",
    amountTypes: "How prices are quoted: 2-5 units separated by | (e.g. per dish | per plate | combo).",
    defaultDescription: "Sentence shown when an item has no description (max 12 words).",
    heroKicker: "Small uppercase label above the headline (2-4 words).",
    heroTitle1: "First line of the big headline (2-4 words).",
    heroTitle2: "Second line of the headline, shown in italics (2-4 words).",
    heroText: "Welcoming paragraph under the headline (25-35 words).",
    heroBadge: "Short reassurance next to the main button (3-5 words).",
    heroCardTitle: "Word after the category count, e.g. 'cuisines' shows '8 cuisines'.",
    heroArt: "One word shown on the hero picture.",
    heroArtSub: "Two words under it.",
    exploreLabel: "Main button text (2-3 words).",
    allLabel: "Label of the show-everything filter (2-3 words).",
    catalogKicker: "Small label above the catalogue heading (2-3 words).",
    catalogTitle: "Catalogue heading (max 8 words).",
    browseLabel: "Button that browses the catalogue (2-3 words).",
    storyKicker: "Small label above the story heading (2-3 words).",
    storyTitle: "Heading of the dark story section (max 8 words).",
    storyText: "Story paragraph (30-45 words).",
    storyStat1: "Label under the first statistic; the number is your category count (1 word).",
    storyStat2: "Label under the second statistic (1 word).",
    storyStat3: "Label under the third statistic (1 word).",
    sessionStart: "Admin button that starts the work (2-3 words).",
    startedTitle: "Notification when work starts (max 8 words, one emoji allowed).",
    sessionWorking: "Banner shown while work is in progress (max 8 words).",
    readyTitle: "Message when an order is ready (max 8 words, one emoji allowed).",
    readyGroup: "Same message for a group order.",
    reviewPrompt: "Question asking for a review (max 6 words).",
    reviewHint: "Placeholder text in the review box.",
    customPlaceholder: "Example text for the custom request box (1-2 sentences).",
    eventSubtitle: "Sentence under an event title (max 14 words).",
};

export const LABEL_KEYS = new Set(LABEL_GROUPS.flatMap((g) => g.fields.map((f) => f[0])));

/** base profile + SuperAdmin overrides (strings; amountTypes stored as "a|b|c") */
export function buildProfile(key, base, overrides = {}) {
    const p = { industry: key, ...base };
    for (const [k, v] of Object.entries(overrides)) {
        if (!LABEL_KEYS.has(k)) continue;
        p[k] = k === "amountTypes" ? String(v).split("|").map((x) => x.trim()).filter(Boolean) : v;
    }
    return p;
}

/* =====================================================================
   WHICH BUSINESS IS THIS REQUEST FOR?
   Many businesses run at once, each on its own address (/mehndi, /barber ...).
   The server middleware puts the business of the current request in an AsyncLocalStorage, so
   getProfile() anywhere in the code returns THAT business's wording without passing it around.
   Outside a request (timers, startup) it falls back to the default business.
   ===================================================================== */
export const industryContext = new AsyncLocalStorage();

let profiles = new Map();     // industryKey -> profile (built-in + custom, with SuperAdmin wording)
let defaultKey = null;

export function setProfiles(map, defKey) { profiles = map; defaultKey = defKey; }

export function getIndustryKey() {
    const key = String(process.env.INDUSTRY || "mehndi").trim().toLowerCase();
    return INDUSTRIES[key] ? key : "mehndi";
}

function envProfile(key) {
    const p = INDUSTRIES[key] || INDUSTRIES.mehndi;
    return {
        industry: INDUSTRIES[key] ? key : "mehndi", ...p,
        name: (process.env.BRAND_NAME || "").trim() || p.name,
        tagline: (process.env.BRAND_TAGLINE || "").trim() || p.tagline,
    };
}

export function getProfile(key) {
    const k = key || industryContext.getStore()?.industryKey || defaultKey || getIndustryKey();
    return profiles.get(k) || envProfile(k);
}
export const getDefaultIndustryKey = () => defaultKey || getIndustryKey();
