import jwt from "jsonwebtoken";
import { query } from "../db/pool.js";

export const ROLES = { SUPERADMIN: "SUPERADMIN", ADMIN: "ADMIN", USER: "USER" };
export const isAdminRole = (role) => role === ROLES.ADMIN || role === ROLES.SUPERADMIN;

/* Admin accounts can be disabled/deleted by the SuperAdmin at any time, so a
   still-valid JWT is not enough. Checked against the DB with a short cache. */
const activeCache = new Map(); // userId -> { ok, at }
const ACTIVE_TTL_MS = 10 * 1000;

export function forgetActiveCache(userId) {
    activeCache.delete(userId);
}

async function isStillActive(userId) {
    const hit = activeCache.get(userId);
    if (hit && Date.now() - hit.at < ACTIVE_TTL_MS) return hit.ok;
    const rows = await query(`SELECT Active FROM mehndi.Users WHERE Id = @id`, { id: userId });
    const ok = rows.length > 0 && rows[0].Active === true;
    activeCache.set(userId, { ok, at: Date.now() });
    return ok;
}

export function signToken(user, expiresIn) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email || "", role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: expiresIn || (isAdminRole(user.role) ? "7d" : "30d") }
    );
}

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token" });

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }

    try {
        if (isAdminRole(payload.role) && !(await isStillActive(payload.id))) {
            return res.status(401).json({ message: "Account disabled or removed" });
        }
    } catch (err) {
        console.error("auth check failed:", err.message);
        return res.status(503).json({ message: "Database unavailable" });
    }

    req.user = payload;
    next();
}

export function requireAdmin(req, res, next) {
    if (!isAdminRole(req.user?.role)) return res.status(403).json({ message: "Admin only" });
    next();
}

export function requireSuperAdmin(req, res, next) {
    if (req.user?.role !== ROLES.SUPERADMIN) {
        return res.status(403).json({ message: "SuperAdmin only" });
    }
    next();
}

/* Convenience chains */
export const adminOnly = [requireAuth, requireAdmin];
export const superAdminOnly = [requireAuth, requireSuperAdmin];
