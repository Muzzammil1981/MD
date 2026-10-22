import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query, withTransaction } from "../db/pool.js";
import { iso } from "../db/pool.js";
import { ROLES, forgetActiveCache } from "../middleware/auth.js";
import { adminOrderScope } from "./adminAccess.js";
import { industryExists, listIndustries } from "./industryService.js";
import { invalidateAdminIndustries } from "./adminAccess.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toUser(r) {
    return {
        id: r.Id,
        username: r.Username,
        email: r.Email || "",
        fullName: r.FullName || "",
        role: r.Role,
        active: r.Active === true,
        createdAt: iso(r.CreatedAt),
        lastLogin: iso(r.LastLogin),
        ...(r.CreatedBy !== undefined ? { createdBy: r.CreatedBy } : {}),
    };
}

async function assertUnique({ username, email, exceptId }) {
    const rows = await query(
        `SELECT Username, Email FROM mehndi.Users
         WHERE (LOWER(Username) = LOWER(@u) OR (@e IS NOT NULL AND LOWER(Email) = LOWER(@e)))
           AND (@x IS NULL OR Id <> @x)`,
        { u: username, e: email || null, x: exceptId || null }
    );
    for (const r of rows) {
        if (r.Username.toLowerCase() === username.toLowerCase()) throw new Error("Username already taken");
        if (email && r.Email && r.Email.toLowerCase() === email.toLowerCase()) throw new Error("Email already registered");
    }
}

function validatePassword(pw, label = "Password") {
    if (!pw || pw.length < 6) throw new Error(`${label} must be at least 6 characters`);
}

/* =========================================================
   Customers (role USER)
   ========================================================= */
export async function registerUser({ username, email, password, fullName }) {
    if (!username?.trim()) throw new Error("Username is required");
    if (!email?.trim()) throw new Error("Email is required");
    if (!EMAIL_RE.test(email)) throw new Error("Invalid email format");
    validatePassword(password);

    const u = username.trim();
    const e = email.trim();
    await assertUnique({ username: u, email: e });

    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const rows = await query(
        `INSERT INTO mehndi.Users (Id, Username, Email, FullName, PasswordHash, Role, Active, LastLogin)
         OUTPUT INSERTED.*
         VALUES (@id, @u, @e, @fn, @h, 'USER', 1, SYSUTCDATETIME())`,
        { id, u, e, fn: (fullName || "").trim(), h: hash }
    );
    return toUser(rows[0]);
}

/**
 * Shared login. `allowedRoles` keeps the two portals separate:
 *   customer site → ["USER"], admin portal → ["ADMIN","SUPERADMIN"]
 */
export async function loginUser({ identifier, password }, allowedRoles) {
    if (!identifier?.trim()) throw new Error("Username or email is required");
    if (!password) throw new Error("Password is required");

    const id = identifier.trim();
    const rows = await query(
        `SELECT TOP 1 * FROM mehndi.Users
         WHERE LOWER(Username) = LOWER(@id) OR LOWER(Email) = LOWER(@id)`,
        { id }
    );
    const user = rows[0];
    if (!user || !allowedRoles.includes(user.Role)) throw new Error("Invalid credentials");
    if (user.Active !== true) throw new Error("Account is disabled");

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) throw new Error("Invalid credentials");

    await query(`UPDATE mehndi.Users SET LastLogin = SYSUTCDATETIME() WHERE Id = @id`, { id: user.Id });
    user.LastLogin = new Date();
    return toUser(user);
}

/** ownerId given (an Admin) → only customers who ordered in that admin's industries / events */
export async function listCustomers({ ownerId } = {}) {
    const rows = ownerId
        ? await query(
            `SELECT u.* FROM mehndi.Users u
             WHERE u.Role = 'USER' AND EXISTS (
                 SELECT 1 FROM mehndi.Orders o WHERE o.UserId = u.Id AND ${adminOrderScope("o")})
             ORDER BY u.CreatedAt DESC`, { me: ownerId })
        : await query(`SELECT * FROM mehndi.Users WHERE Role = 'USER' ORDER BY CreatedAt DESC`);
    return rows.map(toUser);
}

export async function getUserById(id) {
    const rows = await query(`SELECT * FROM mehndi.Users WHERE Id = @id`, { id });
    return rows[0] ? toUser(rows[0]) : null;
}

/* ---------- Change own password (any role) ---------- */
export async function changePassword({ userId, currentPassword, newPassword }) {
    if (!currentPassword) throw new Error("Current password is required");
    validatePassword(newPassword, "New password");

    const rows = await query(`SELECT PasswordHash FROM mehndi.Users WHERE Id = @id`, { id: userId });
    if (!rows[0]) throw new Error("User not found");
    if (!(await bcrypt.compare(currentPassword, rows[0].PasswordHash))) {
        throw new Error("Current password is incorrect");
    }
    await query(
        `UPDATE mehndi.Users SET PasswordHash = @h, PasswordChangedAt = SYSUTCDATETIME() WHERE Id = @id`,
        { id: userId, h: await bcrypt.hash(newPassword, 10) }
    );
    return { ok: true };
}

/* ---------- Admin/SuperAdmin: reset a CUSTOMER's password ---------- */
export async function adminResetCustomerPassword({ userId, newPassword }) {
    validatePassword(newPassword, "New password");
    const rows = await query(`SELECT Username, Role FROM mehndi.Users WHERE Id = @id`, { id: userId });
    if (!rows[0]) throw new Error("User not found");
    if (rows[0].Role !== ROLES.USER) throw new Error("Only customer passwords can be reset here");

    await query(
        `UPDATE mehndi.Users SET PasswordHash = @h, PasswordChangedAt = SYSUTCDATETIME() WHERE Id = @id`,
        { id: userId, h: await bcrypt.hash(newPassword, 10) }
    );
    return { ok: true, username: rows[0].Username };
}

/* =========================================================
   Admin accounts - managed ONLY by the SuperAdmin
   ========================================================= */
/* industries assigned to each admin: Map(adminId -> [{key, name}]) */
async function industriesByAdmin(adminIds = null) {
    const rows = await query(`SELECT AdminId, IndustryKey FROM mehndi.AdminIndustries`);
    const names = new Map((await listIndustries()).industries.map((i) => [i.key, i.name]));
    const map = new Map();
    for (const r of rows) {
        if (adminIds && !adminIds.includes(r.AdminId)) continue;
        if (!map.has(r.AdminId)) map.set(r.AdminId, []);
        map.get(r.AdminId).push({ key: r.IndustryKey, name: names.get(r.IndustryKey) || r.IndustryKey });
    }
    return map;
}

async function validateIndustries(keys) {
    const list = [...new Set((Array.isArray(keys) ? keys : []).map(String))];
    if (!list.length) throw new Error("Choose at least one industry for this admin");
    for (const k of list) if (!(await industryExists(k))) throw new Error(`Unknown industry: ${k}`);
    return list;
}

export async function listAdmins() {
    const rows = await query(
        `SELECT * FROM mehndi.Users WHERE Role = 'ADMIN' ORDER BY CreatedAt DESC`
    );
    const inds = await industriesByAdmin();
    return rows.map((r) => ({ ...toUser(r), industries: inds.get(r.Id) || [] }));
}

export async function createAdmin({ username, email, password, fullName, createdBy, industries }) {
    if (!username?.trim()) throw new Error("Username is required");
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username.trim())) {
        throw new Error("Username must be 3-50 characters (letters, numbers, . _ -)");
    }
    const e = (email || "").trim();
    if (e && !EMAIL_RE.test(e)) throw new Error("Invalid email format");
    validatePassword(password);
    const keys = await validateIndustries(industries);

    const u = username.trim();
    await assertUnique({ username: u, email: e || null });

    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const row = await withTransaction(async (tx) => {
        const rows = await query(
            `INSERT INTO mehndi.Users (Id, Username, Email, FullName, PasswordHash, Role, Active, CreatedBy)
             OUTPUT INSERTED.*
             VALUES (@id, @u, @e, @fn, @h, 'ADMIN', 1, @by)`,
            { id, u, e: e || null, fn: (fullName || "").trim(), h: hash, by: createdBy || null }, tx);
        for (const k of keys) {
            await query(`INSERT INTO mehndi.AdminIndustries (AdminId, IndustryKey) VALUES (@a, @k)`, { a: id, k }, tx);
        }
        return rows[0];
    });
    invalidateAdminIndustries(id);
    return { ...toUser(row), industries: (await industriesByAdmin([id])).get(id) || [] };
}

/** Replace the industries an admin may work in (SuperAdmin decides). */
export async function setAdminIndustries(id, industries) {
    await getAdminRow(id);
    const keys = await validateIndustries(industries);
    await withTransaction(async (tx) => {
        await query(`DELETE FROM mehndi.AdminIndustries WHERE AdminId = @a`, { a: id }, tx);
        for (const k of keys) {
            await query(`INSERT INTO mehndi.AdminIndustries (AdminId, IndustryKey) VALUES (@a, @k)`, { a: id, k }, tx);
        }
    });
    invalidateAdminIndustries(id);
    return { keys, industries: (await industriesByAdmin([id])).get(id) || [] };
}

async function getAdminRow(id) {
    const rows = await query(`SELECT * FROM mehndi.Users WHERE Id = @id`, { id });
    const row = rows[0];
    if (!row) throw new Error("Admin not found");
    if (row.Role !== ROLES.ADMIN) throw new Error("This account is not an Admin");
    return row;
}

export async function updateAdmin({ id, fullName, email, active }) {
    const row = await getAdminRow(id);
    const newEmail = email !== undefined ? (String(email).trim() || null) : row.Email;
    if (newEmail && !EMAIL_RE.test(newEmail)) throw new Error("Invalid email format");
    if (newEmail !== row.Email) await assertUnique({ username: row.Username, email: newEmail, exceptId: id });

    const updated = await query(
        `UPDATE mehndi.Users
            SET FullName = @fn, Email = @e, Active = @a
         OUTPUT INSERTED.*
         WHERE Id = @id`,
        {
            id,
            fn: fullName !== undefined ? String(fullName).trim() : row.FullName,
            e: newEmail,
            a: active !== undefined ? Boolean(active) : row.Active,
        }
    );
    forgetActiveCache(id);
    return toUser(updated[0]);
}

export async function resetAdminPassword({ id, newPassword }) {
    validatePassword(newPassword, "New password");
    const row = await getAdminRow(id);
    await query(
        `UPDATE mehndi.Users SET PasswordHash = @h, PasswordChangedAt = SYSUTCDATETIME() WHERE Id = @id`,
        { id, h: await bcrypt.hash(newPassword, 10) }
    );
    return { ok: true, username: row.Username };
}

/** Deleting an admin never deletes their work: their events and uploaded designs move to `transferToId`. */
export async function deleteAdmin(id, transferToId) {
    await getAdminRow(id); // throws if missing / not an admin
    await withTransaction(async (tx) => {
        await query(`UPDATE mehndi.Events  SET OwnerId    = @to WHERE OwnerId    = @id`, { id, to: transferToId }, tx);
        await query(`UPDATE mehndi.Designs SET UploadedBy = @to WHERE UploadedBy = @id`, { id, to: transferToId }, tx);
        await query(`DELETE FROM mehndi.Users WHERE Id = @id AND Role = 'ADMIN'`, { id }, tx);
    });
    forgetActiveCache(id);
    return { ok: true };
}
