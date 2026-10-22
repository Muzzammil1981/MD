import { query } from "../db/pool.js";

/* =========================================================
   Which industries may an ADMIN work in?  (SuperAdmin: all of them)
   An Admin's orders / reviews / reports / customers are limited to those industries -
   and, for event orders, to events the admin created.
   ========================================================= */
const TTL = 10 * 1000;
const cache = new Map();   // adminId -> { keys, at }

export function invalidateAdminIndustries(adminId) { cache.delete(adminId); }

export async function getAdminIndustries(adminId) {
    const hit = cache.get(adminId);
    if (hit && Date.now() - hit.at < TTL) return hit.keys;
    const rows = await query(`SELECT IndustryKey FROM mehndi.AdminIndustries WHERE AdminId = @id`, { id: adminId });
    const keys = rows.map((r) => r.IndustryKey);
    cache.set(adminId, { keys, at: Date.now() });
    return keys;
}

/** May this signed-in admin work in this industry? */
export async function canAccessIndustry(user, industryKey) {
    if (!user) return false;
    if (user.role === "SUPERADMIN") return true;
    if (user.role !== "ADMIN" || !industryKey) return false;
    return (await getAdminIndustries(user.id)).includes(industryKey);
}

/**
 * SQL condition: "this order is one the admin @me may see/act on".
 * `o` is the alias of mehndi.Orders. Bind @me = the admin's id.
 *   - the order's industry is one of the admin's industries, AND
 *   - it is a normal booking (shared by every admin of that industry) or an event the admin created
 */
export const adminOrderScope = (o = "o") => `(
    ${o}.IndustryKey IN (SELECT IndustryKey FROM mehndi.AdminIndustries WHERE AdminId = @me)
    AND (${o}.EventId IS NULL OR ${o}.EventId IN (SELECT Id FROM mehndi.Events WHERE OwnerId = @me))
)`;
