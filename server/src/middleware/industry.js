import jwt from "jsonwebtoken";
import { industryContext, getDefaultIndustryKey } from "../config/industries.js";
import { resolveSlug } from "../services/businessService.js";

/* =====================================================================
   Which business is this request for?
   The website sends  X-Industry: <slug>  (taken from the address bar: /barber → "barber").
   - unknown address            → 404 "Business not found"
   - unpublished business       → only signed-in staff (to preview it before going public)
   - no header (old links, API) → the default business
   Everything below this middleware sees the right business through getProfile().
   ===================================================================== */
function isStaff(req) {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return false;
    try {
        const { role } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        return role === "ADMIN" || role === "SUPERADMIN";
    } catch { return false; }
}

export function industryMiddleware(req, res, next) {
    const slug = String(req.get("x-industry") || "").trim().toLowerCase();
    let key = getDefaultIndustryKey();
    let explicit = false;

    if (slug) {
        const biz = resolveSlug(slug);
        if (!biz || (!biz.published && !isStaff(req))) return res.status(404).json({ message: "Business not found" });
        key = biz.key;
        explicit = true;
    }
    industryContext.run({ industryKey: key, explicit, slug }, next);
}

/** The business of the current request (for code that needs more than getProfile()). */
export const currentIndustry = () => industryContext.getStore() || { industryKey: getDefaultIndustryKey(), explicit: false };
