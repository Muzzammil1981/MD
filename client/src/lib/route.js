/* =====================================================================
   Which page is this?  (decided once from the address bar)
     /                      → directory of all businesses
     /admin                 → admin portal
     /monitor?event=ID      → queue screen (old link; uses the default business)
     /<slug>                → one business   e.g. /mehndi  /hair-beauty  /barber
     /<slug>/monitor?event= → queue screen of that business
   ===================================================================== */
function parse() {
    const segs = window.location.pathname.split("/").filter(Boolean);
    if (!segs.length) return { kind: "directory", slug: null };
    const first = decodeURIComponent(segs[0]).toLowerCase();
    if (first === "admin") return { kind: "admin", slug: null };
    if (first === "monitor") return { kind: "monitor", slug: null };
    if (segs[1] && segs[1].toLowerCase() === "monitor") return { kind: "monitor", slug: first };
    return { kind: "business", slug: first };
}

export const routeInfo = parse();
