import { api } from "./api";

/* =====================================================================
   BRAND / INDUSTRY LABELS
   The server tells the app which business it is (barber, salon, car wash, Mehndi…)
   through GET /api/config. Everything the customer reads comes from `B`.
   It is loaded ONCE before the app renders (see main.jsx), so components can
   simply read `B.item`, `B.Items`, `B.name` ...
   The defaults below are the original Mehndi wording (used if the server is unreachable).
   ===================================================================== */
export const B = {
    industry: "mehndi",
    name: "Mehndi Studio",
    tagline: "Art on your hands",
    item: "design", items: "designs", custom: "custom design", customRequest: "custom design request",
    amountTypes: ["per design", "per hand", "per pair", "per hour", "package"],
    sessionStart: "Start Mehndi session",
    sessionWorking: "Studio is working on your design",
    readyTitle: "Your Mehndi is ready! 🎨",
    readyGroup: "Your group session is complete! 🎨",
    reviewPrompt: "How was your Mehndi?",
    reviewHint: "The design, the finish, the service…",
    heroKicker: "Curated Mehndi Collection",
    heroTitle1: "Where tradition",
    heroTitle2: "becomes art.",
    heroText: "Explore expressive Mehndi designs across seven distinctive styles. Save your favourites, discover details and build your selection beautifully.",
    heroBadge: "Designed for every occasion",
    heroCardTitle: "signature styles",
    heroArt: "Mehndi",
    heroArtSub: "timeless craft",
    catalogKicker: "The collection", catalogTitle: "Find your signature style.",
    browseLabel: "Browse styles", allLabel: "All styles", exploreLabel: "Explore collection",
    storyKicker: "The idea",
    storyTitle: "Every pattern has a personality.",
    storyText: "From a quick Arabic trail to an elaborate bridal composition, Mehndi is more than decoration. This collection is designed to make discovering that expression simple, visual and personal.",
    storyStat1: "Styles", storyStat2: "Possibilities", storyStat3: "Signature",
    footerTagline: "A modern catalog for a timeless craft.",
    customPlaceholder: "e.g. Bridal mehndi with peacock motifs on both hands, extending to elbows. Prefer front and back coverage.",
    eventSubtitle: "Exclusive designs and special pricing for a limited time only.",
    defaultDescription: "A beautifully composed Mehndi design.",
    metaDescription: "Discover beautiful Mehndi designs by style, occasion and price. Book appointments and manage your orders.",
    categories: [],
};

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* Capitalised variants + initial letter, kept in sync whenever B changes */
function derive() {
    B.Item = cap(B.item);
    B.Items = cap(B.items);
    B.Custom = cap(B.custom);
    B.CustomRequest = cap(B.customRequest);
    B.initial = (B.name || "M").trim()[0].toUpperCase();
    B.defaultAmountType = B.amountTypes?.[0] || "per item";
    B.firstCategoryId = B.categories?.[0]?.id || "";
}
derive();

function applyToPage() {
    document.title = `${B.name} - ${B.tagline}`;
    const set = (sel, attr, value) => document.querySelector(sel)?.setAttribute(attr, value);
    set('meta[name="description"]', "content", B.metaDescription);
    set('meta[name="author"]', "content", B.name);
    set('meta[name="application-name"]', "content", B.name);
    set('meta[name="apple-mobile-web-app-title"]', "content", B.name);
    set('meta[property="og:site_name"]', "content", B.name);
    set('meta[property="og:title"]', "content", `${B.name} - ${B.tagline}`);
    set('meta[property="og:description"]', "content", B.metaDescription);
    set('meta[name="twitter:title"]', "content", `${B.name} - ${B.tagline}`);
    set('meta[name="twitter:description"]', "content", B.metaDescription);
}

/** returns "ok" | "notfound" (no such / unpublished business) | "offline" */
export async function loadBrand() {
    let status = "ok";
    try {
        const { data } = await api.get("/api/config", { timeout: 4000 });
        Object.assign(B, data);
    } catch (err) {
        status = err.response?.status === 404 ? "notfound" : "offline";
        console.warn("Could not load /api/config.", err.message);
    }
    derive();
    if (status === "ok") applyToPage();
    return status;
}
