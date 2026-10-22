/* =====================================================================
   INDUSTRY PROFILES
   One codebase, many businesses. Pick one with  INDUSTRY=barber  in .env
   (mehndi | barber | salon | carwash). Optionally override the shop name with
   BRAND_NAME / BRAND_TAGLINE. Use ONE database per business.

   To add a new industry: copy a profile below, change the words and categories.
   ===================================================================== */

const cat = (id, name, shortName, description, accent) => ({ id, name, shortName, description, accent });

export const INDUSTRIES = {
    /* ------------------------------------------------------------ Mehndi (original) */
    mehndi: {
        name: "Mehndi Studio",
        tagline: "Art on your hands",
        item: "design", items: "designs", custom: "custom design",
        customRequest: "custom design request",
        defaultDescription: "A beautifully composed Mehndi design.",
        amountTypes: ["per design", "per hand", "per pair", "per hour", "package"],
        sessionStart: "Start Mehndi session",
        catalogKicker: "The collection", catalogTitle: "Find your signature style.", browseLabel: "Browse styles", allLabel: "All styles", exploreLabel: "Explore collection",
        startedTitle: "Your Mehndi session started ✨",
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
        storyKicker: "The idea",
        storyTitle: "Every pattern has a personality.",
        storyText: "From a quick Arabic trail to an elaborate bridal composition, Mehndi is more than decoration. This collection is designed to make discovering that expression simple, visual and personal.",
        storyStat1: "Styles", storyStat2: "Possibilities", storyStat3: "Signature",
        footerTagline: "A modern catalog for a timeless craft.",
        customPlaceholder: "e.g. Bridal mehndi with peacock motifs on both hands, extending to elbows. Prefer front and back coverage.",
        eventSubtitle: "Exclusive designs and special pricing for a limited time only.",
        metaDescription: "Discover beautiful Mehndi designs by style, occasion and price. Book appointments, pay via UPI, and manage your orders - all in one place.",
        categories: [
            cat("arabic", "Arabic Mehndi", "Arabic", "Bold floral trails, statement motifs and elegant negative space.", "Warm & graceful"),
            cat("indian", "Indian Mehndi", "Indian", "Intricate paisleys, peacocks, florals and detailed traditional storytelling.", "Intricate & rich"),
            cat("pakistani", "Pakistani Mehndi", "Pakistani", "Mandalas, domes, architectural details and beautifully detailed fingers.", "Detailed & regal"),
            cat("moroccan", "Moroccan Mehndi", "Moroccan", "Geometric diamonds, grids, zig-zags and clean tribal-inspired lines.", "Geometric & bold"),
            cat("indo-arabic", "Indo-Arabic Mehndi", "Indo-Arabic", "Arabic openness meets Indian detail for a balanced statement look.", "Balanced & expressive"),
            cat("minimal-modern", "Minimal / Modern", "Modern", "Clean lines, small focal motifs and contemporary negative space.", "Clean & modern"),
            cat("bridal", "Bridal Mehndi", "Bridal", "Full, luxurious compositions for weddings, celebrations and bridal moments.", "Grand & timeless"),
        ],
    },

    /* ------------------------------------------------------------ Barber shop */
    barber: {
        name: "The Barber Shop",
        tagline: "Sharp cuts. Clean fades.",
        item: "service", items: "services", custom: "special request",
        customRequest: "special request",
        defaultDescription: "A professional service by our expert barbers.",
        amountTypes: ["per service", "per session", "package"],
        sessionStart: "Start service",
        catalogKicker: "Our services", catalogTitle: "Find your perfect cut.", browseLabel: "Browse services", allLabel: "All services", exploreLabel: "Explore services",
        startedTitle: "Your service has started ✂️",
        sessionWorking: "Your barber is working on you",
        readyTitle: "You're all done! ✂️",
        readyGroup: "Your group is all done! ✂️",
        reviewPrompt: "How was your visit?",
        reviewHint: "The cut, the finish, the service…",
        heroKicker: "Premium Grooming",
        heroTitle1: "Look sharp.",
        heroTitle2: "Feel unstoppable.",
        heroText: "Browse our haircuts, beard styling and grooming packages. Pick your services, choose a time that suits you and walk in to a chair that's ready.",
        heroBadge: "Walk in confident",
        heroCardTitle: "grooming categories",
        heroArt: "Barber",
        heroArtSub: "precision craft",
        storyKicker: "The idea",
        storyTitle: "Every cut tells a story.",
        storyText: "A great cut is about more than hair. We combine classic technique with modern style so you leave looking and feeling your best - booked in seconds, no waiting around.",
        storyStat1: "Categories", storyStat2: "Styles", storyStat3: "Standard",
        footerTagline: "Craft, precision and a clean finish.",
        customPlaceholder: "e.g. Skin fade with a textured top, beard shaped to a sharp line. Please keep the sides short.",
        eventSubtitle: "Special offers and pricing for a limited time only.",
        metaDescription: "Book haircuts, beard trims and grooming packages online. Choose your service, pick a free time slot and pay securely.",
        categories: [
            cat("haircuts", "Haircuts", "Haircuts", "Classic cuts, fades, tapers and modern styles tailored to you.", "Sharp & clean"),
            cat("beard-shave", "Beard & Shave", "Beard", "Beard shaping, hot-towel shaves and precise line-ups.", "Smooth & precise"),
            cat("kids-cuts", "Kids' Cuts", "Kids", "Patient, friendly cuts for the younger gentlemen.", "Fun & friendly"),
            cat("hair-colour", "Hair Colour", "Colour", "Colouring, highlights and grey blending.", "Bold & natural"),
            cat("facials-skin", "Facials & Skin", "Skin", "Cleanups, facials and skin care for men.", "Fresh & glowing"),
            cat("head-massage", "Head Massage", "Massage", "Relaxing head, neck and shoulder massage.", "Calm & relaxed"),
            cat("grooming-packages", "Grooming Packages", "Packages", "Cut, beard and skin care bundled for the full treatment.", "Complete & value"),
        ],
    },

    /* ------------------------------------------------------------ Hair & beauty salon */
    salon: {
        name: "Glow Salon",
        tagline: "Beauty, beautifully done",
        item: "service", items: "services", custom: "special request",
        customRequest: "special request",
        defaultDescription: "A professional service by our expert stylists.",
        amountTypes: ["per service", "per session", "per hour", "package"],
        sessionStart: "Start service",
        catalogKicker: "Our services", catalogTitle: "Find your perfect treatment.", browseLabel: "Browse services", allLabel: "All services", exploreLabel: "Explore services",
        startedTitle: "Your service has started ✨",
        sessionWorking: "Your stylist is working on you",
        readyTitle: "You look amazing! ✨",
        readyGroup: "Your group is all done! ✨",
        reviewPrompt: "How was your visit?",
        reviewHint: "The service, the result, the stylist…",
        heroKicker: "Hair & Beauty",
        heroTitle1: "Your best look,",
        heroTitle2: "beautifully done.",
        heroText: "From hair styling and colour to skin, nails and bridal makeup - choose your services, pick a time and let our stylists take care of the rest.",
        heroBadge: "For every occasion",
        heroCardTitle: "beauty categories",
        heroArt: "Glow",
        heroArtSub: "hair & beauty",
        storyKicker: "Our promise",
        storyTitle: "Beauty with a personal touch.",
        storyText: "Every guest is different. Our team listens first, then creates a look that suits you - for everyday confidence or your biggest day.",
        storyStat1: "Categories", storyStat2: "Looks", storyStat3: "Promise",
        footerTagline: "Hair, skin and beauty - all in one place.",
        customPlaceholder: "e.g. Balayage with soft caramel tones, shoulder-length layers. Prefer low-maintenance styling.",
        eventSubtitle: "Seasonal offers and special pricing for a limited time only.",
        metaDescription: "Book hair, skin, nail and makeup services online. Choose your service, pick a free time slot and pay securely.",
        categories: [
            cat("hair-styling", "Hair Cut & Styling", "Hair", "Cuts, blow-dries and styling for every length.", "Chic & fresh"),
            cat("colour", "Colour & Highlights", "Colour", "Global colour, balayage, highlights and toning.", "Vibrant & rich"),
            cat("hair-treatments", "Hair Treatments", "Treatments", "Keratin, smoothing, spa and repair treatments.", "Smooth & healthy"),
            cat("facials", "Facials & Skin", "Skin", "Facials, cleanups and glow treatments.", "Radiant & fresh"),
            cat("nails", "Nails", "Nails", "Manicure, pedicure, gel and nail art.", "Polished & neat"),
            cat("waxing", "Waxing & Threading", "Waxing", "Quick, gentle hair removal.", "Smooth & quick"),
            cat("makeup-bridal", "Makeup & Bridal", "Makeup", "Party makeup, bridal makeup and styling.", "Glamorous & timeless"),
        ],
    },

    /* ------------------------------------------------------------ Car wash / detailing */
    carwash: {
        name: "Sparkle Car Wash",
        tagline: "Shine you can see",
        item: "service", items: "services", custom: "special request",
        customRequest: "special request",
        defaultDescription: "A careful, professional service for your vehicle.",
        amountTypes: ["per vehicle", "per car", "per bike", "package"],
        sessionStart: "Start wash",
        catalogKicker: "Our packages", catalogTitle: "Find the right care for your car.", browseLabel: "Browse services", allLabel: "All services", exploreLabel: "Explore services",
        startedTitle: "We've started on your vehicle 🚗",
        sessionWorking: "We're working on your vehicle",
        readyTitle: "Your vehicle is ready! 🚗",
        readyGroup: "All your vehicles are ready! 🚗",
        reviewPrompt: "How was your wash?",
        reviewHint: "The cleaning, the finish, the service…",
        heroKicker: "Car Care & Detailing",
        heroTitle1: "Drive in dirty.",
        heroTitle2: "Drive out sparkling.",
        heroText: "Exterior washes, interior cleaning, full detailing and paint protection. Choose a package, book a free bay and we'll have your car looking new.",
        heroBadge: "Quick, careful, spotless",
        heroCardTitle: "care categories",
        heroArt: "Sparkle",
        heroArtSub: "car care",
        storyKicker: "Why us",
        storyTitle: "Care for every vehicle.",
        storyText: "Whether it's a quick rinse or a full detail, we treat every vehicle like our own - with the right products, the right process and no rushing.",
        storyStat1: "Categories", storyStat2: "Packages", storyStat3: "Standard",
        footerTagline: "Spotless results, every time.",
        customPlaceholder: "e.g. SUV with pet hair on the back seats and a stain on the driver's seat. Please focus on the interior.",
        eventSubtitle: "Seasonal offers and special pricing for a limited time only.",
        metaDescription: "Book car washes, interior cleaning and detailing online. Choose your package, pick a free bay time and pay securely.",
        categories: [
            cat("exterior-wash", "Exterior Wash", "Exterior", "Hand wash, foam wash and drying.", "Fast & fresh"),
            cat("interior-cleaning", "Interior Cleaning", "Interior", "Vacuum, dashboard, seats and glass cleaning.", "Clean & fresh"),
            cat("full-detailing", "Full Detailing", "Detailing", "Deep clean inside and out.", "Showroom finish"),
            cat("polish-wax", "Polish & Wax", "Polish", "Machine polish and protective wax.", "Glossy & smooth"),
            cat("paint-protection", "Paint Protection", "Protection", "Ceramic coating and long-lasting paint protection.", "Durable & deep"),
            cat("engine-underbody", "Engine & Underbody", "Engine", "Engine bay and underbody cleaning.", "Thorough & safe"),
            cat("add-ons", "Add-ons", "Add-ons", "Odour removal, headlight restoration and extras.", "Extra care"),
        ],
    },
};

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

/* The profile in use. The server fills it from the database at start-up and whenever the
   SuperAdmin changes it; until then it falls back to INDUSTRY in .env. */
let active = null;
export const setActiveProfile = (p) => { active = p; };

export function getIndustryKey() {
    const key = String(process.env.INDUSTRY || "mehndi").trim().toLowerCase();
    return INDUSTRIES[key] ? key : "mehndi";
}

export function getProfile() {
    if (active) return active;
    const key = getIndustryKey();
    const p = INDUSTRIES[key];
    return {
        industry: key,
        ...p,
        name: (process.env.BRAND_NAME || "").trim() || p.name,
        tagline: (process.env.BRAND_TAGLINE || "").trim() || p.tagline,
    };
}
