import { query, withTransaction, iso } from "../db/pool.js";
import { ROLES } from "../middleware/auth.js";
import { getProfile, cap } from "../config/industries.js";
import { slugOf } from "./businessService.js";

/* Every event row comes with its owner (the admin who created it) */
const EVENT_SELECT = `
    SELECT e.*, u.Username AS OwnerName
    FROM mehndi.Events e
    LEFT JOIN mehndi.Users u ON u.Id = e.OwnerId`;

function parseDate(v, label) {
    const d = new Date(v);
    if (isNaN(d.getTime())) throw Object.assign(new Error(label || "Invalid dates"), { status: 400 });
    return d;
}

/* Build API events (with designIds + priceOverrides) from rows */
async function hydrate(eventRows) {
    if (!eventRows.length) return [];

    const designRows = await query(`SELECT EventId, DesignId FROM mehndi.EventDesigns`);
    const priceRows = await query(`SELECT EventId, DesignId, Price FROM mehndi.EventPriceOverrides`);

    const designsBy = new Map();
    for (const r of designRows) {
        if (!designsBy.has(r.EventId)) designsBy.set(r.EventId, []);
        designsBy.get(r.EventId).push(r.DesignId);
    }
    const pricesBy = new Map();
    for (const r of priceRows) {
        if (!pricesBy.has(r.EventId)) pricesBy.set(r.EventId, {});
        pricesBy.get(r.EventId)[r.DesignId] = Number(r.Price);
    }

    return eventRows.map((r) => ({
        id: r.Id,
        name: r.Name,
        startDate: iso(r.StartDate),
        endDate: iso(r.EndDate),
        designIds: r.AllDesigns === true ? ["all"] : (designsBy.get(r.Id) || []),
        priceOverrides: pricesBy.get(r.Id) || {},
        tokenCounter: r.TokenCounter,
        ownerId: r.OwnerId || null,
        industryKey: r.IndustryKey || null,
        businessSlug: slugOf(r.IndustryKey),
        ownerName: r.OwnerName || null,
        createdAt: iso(r.CreatedAt),
        ...(r.UpdatedAt ? { updatedAt: iso(r.UpdatedAt) } : {}),
    }));
}

/** SuperAdmin → every event. Admin → only the events they created. */
export async function listEvents(user) {
    const scoped = user && user.role !== ROLES.SUPERADMIN;
    const rows = await query(
        `${EVENT_SELECT} ${scoped ? "WHERE e.OwnerId = @o" : ""} ORDER BY e.CreatedAt ASC`,
        scoped ? { o: user.id } : {}
    );
    return hydrate(rows);
}

/** May this admin manage this event? (SuperAdmin: always; Admin: only their own) */
export async function canAccessEvent(user, eventId) {
    if (!user) return false;
    if (user.role === ROLES.SUPERADMIN) return true;
    if (user.role !== ROLES.ADMIN || !eventId) return false;
    const rows = await query(`SELECT OwnerId FROM mehndi.Events WHERE Id = @id`, { id: eventId });
    return rows[0]?.OwnerId === user.id;
}

export async function getEvent(id) {
    const rows = await query(`${EVENT_SELECT} WHERE e.Id = @id`, { id });
    return (await hydrate(rows))[0] || null;
}

export async function createEvent({ name, startDate, endDate, designIds, priceOverrides }, ownerId) {
    if (!name || !startDate || !endDate) {
        throw Object.assign(new Error("Name, start date, and end date are required"), { status: 400 });
    }
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (end <= start) throw Object.assign(new Error("End date must be after start date"), { status: 400 });

    const ids = Array.isArray(designIds) ? designIds.map(String) : [];
    const all = ids.includes("all");
    const specific = ids.filter((x) => x !== "all");
    const overrides = priceOverrides && typeof priceOverrides === "object" && !Array.isArray(priceOverrides)
        ? priceOverrides : {};

    const id = `event-${Date.now()}`;
    await withTransaction(async (tx) => {
        await query(
            `INSERT INTO mehndi.Events (Id, Name, StartDate, EndDate, AllDesigns, OwnerId, IndustryKey)
             VALUES (@id, @name, @s, @e, @all, @owner, @ind)`,
            { id, name: String(name).trim(), s: start, e: end, all, owner: ownerId || null, ind: getProfile().industry },
            tx
        );
        await replaceEventDesigns(id, all ? [] : specific, overrides, tx);
    });
    return getEvent(id);
}

/* Insert only designs that still exist (FK-safe), one INSERT per design id */
async function replaceEventDesigns(eventId, designIds, overrides, tx) {
    await query(`DELETE FROM mehndi.EventDesigns WHERE EventId = @id`, { id: eventId }, tx);
    await query(`DELETE FROM mehndi.EventPriceOverrides WHERE EventId = @id`, { id: eventId }, tx);

    for (const designId of designIds) {
        await query(
            `INSERT INTO mehndi.EventDesigns (EventId, DesignId)
             SELECT @e, Id FROM mehndi.Designs WHERE Id = @d`,
            { e: eventId, d: designId }, tx
        );
    }
    for (const [designId, price] of Object.entries(overrides || {})) {
        const p = Number(price);
        if (!Number.isFinite(p) || p < 0) continue;
        await query(
            `INSERT INTO mehndi.EventPriceOverrides (EventId, DesignId, Price)
             SELECT @e, Id, @p FROM mehndi.Designs WHERE Id = @d`,
            { e: eventId, d: designId, p }, tx
        );
    }
}

export async function updateEvent(id, { name, startDate, endDate }) {
    const existing = await query(`SELECT * FROM mehndi.Events WHERE Id = @id`, { id });
    if (!existing[0]) throw Object.assign(new Error("Event not found"), { status: 404 });

    let start = existing[0].StartDate;
    let end = existing[0].EndDate;
    if (startDate) start = parseDate(startDate, "Invalid start date");
    if (endDate) end = parseDate(endDate, "Invalid end date");
    if (startDate && endDate && end <= start) {
        throw Object.assign(new Error("End date must be after start date"), { status: 400 });
    }

    await query(
        `UPDATE mehndi.Events SET Name = @n, StartDate = @s, EndDate = @e, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`,
        { id, n: name !== undefined ? String(name).trim() : existing[0].Name, s: start, e: end }
    );
    return getEvent(id);
}

export async function deleteEvent(id) {
    const rows = await query(`DELETE FROM mehndi.Events OUTPUT DELETED.Id WHERE Id = @id`, { id });
    return rows.length > 0;
}

/* =========================================================
   Live queue for the monitor screen
   ========================================================= */
export async function buildEventQueue(eventId) {
    const event = await getEvent(eventId);
    if (!event) return null;

    const singles = await query(
        `SELECT o.Username, o.Type, o.Status, o.TokenNumber, o.StartedAt, o.DurationSeconds, o.CustomImage,
                it.Name AS ItemName, it.Image AS ItemImage
         FROM mehndi.Orders o
         OUTER APPLY (SELECT TOP 1 Name, Image FROM mehndi.OrderItems i
                      WHERE i.OrderId = o.Id AND i.MemberId IS NULL
                      ORDER BY i.SortOrder, i.Id) it
         WHERE o.EventId = @e AND o.IsGroup = 0 AND o.TokenNumber IS NOT NULL`,
        { e: eventId }
    );

    const members = await query(
        `SELECT m.Name, m.TokenNumber, m.Status, m.StartedAt, m.DurationSeconds,
                o.Username AS OwnerName, o.Status AS OrderStatus,
                it.Name AS ItemName, it.Image AS ItemImage
         FROM mehndi.OrderMembers m
         JOIN mehndi.Orders o ON o.Id = m.OrderId
         OUTER APPLY (SELECT TOP 1 Name, Image FROM mehndi.OrderItems i
                      WHERE i.OrderId = m.OrderId AND i.MemberId = m.MemberId
                      ORDER BY i.SortOrder, i.Id) it
         WHERE o.EventId = @e AND o.IsGroup = 1 AND m.TokenNumber IS NOT NULL`,
        { e: eventId }
    );

    const tokens = [];

    for (const m of members) {
        // Members stay "pending" until the admin clicks Start. If the parent order
        // is already paid / in progress, show them as "paid" so they appear in Up-next.
        let status = m.Status || "pending";
        if (status === "pending" && (m.OrderStatus === "paid" || m.OrderStatus === "in-progress")) {
            status = "paid";
        }
        tokens.push({
            tokenNumber: m.TokenNumber,
            username: m.Name || m.OwnerName,
            groupOwner: m.OwnerName,
            isGroupMember: true,
            image: m.ItemImage || null,
            itemName: m.ItemName || "Group booking",
            status,
            startedAt: iso(m.StartedAt),
            durationSeconds: m.DurationSeconds || 0,
        });
    }

    for (const o of singles) {
        const isCustom = o.Type === "custom";
        tokens.push({
            tokenNumber: o.TokenNumber,
            username: o.Username,
            isGroupMember: false,
            image: o.ItemImage || o.CustomImage || null,
            itemName: o.ItemName || (isCustom ? cap(getProfile().custom) : cap(getProfile().item)),
            status: o.Status,
            startedAt: iso(o.StartedAt),
            durationSeconds: o.DurationSeconds || 0,
            isCustom,
        });
    }

    const nowServing = tokens.filter((t) => t.status === "in-progress")
        .sort((a, b) => a.tokenNumber - b.tokenNumber);
    const upNext = tokens.filter((t) => t.status === "paid")
        .sort((a, b) => a.tokenNumber - b.tokenNumber).slice(0, 6);
    const recentlyCompleted = tokens.filter((t) => t.status === "completed")
        .sort((a, b) => b.tokenNumber - a.tokenNumber).slice(0, 4);

    return {
        event: { id: event.id, name: event.name },
        nowServing,
        upNext,
        recentlyCompleted,
        totalTokens: event.tokenCounter || 0,
        lastUpdated: new Date().toISOString(),
    };
}
