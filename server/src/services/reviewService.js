import crypto from "crypto";
import { query, withTransaction, iso } from "../db/pool.js";
import { adminCanAccessOrder } from "./orderService.js";
import { adminOrderScope } from "./adminAccess.js";

/* Reviews are written by customers about a COMPLETED order (one review per order).
   The review is shown on the home page and on every design that was in that order. */

async function attachDesigns(rows) {
    const map = new Map(rows.map((r) => [r.Id, []]));
    if (!rows.length) return map;
    const params = {};
    rows.forEach((r, i) => { params[`r${i}`] = r.Id; });
    const links = await query(
        `SELECT rd.ReviewId, d.Id, d.Name
         FROM mehndi.ReviewDesigns rd JOIN mehndi.Designs d ON d.Id = rd.DesignId
         WHERE rd.ReviewId IN (${rows.map((_, i) => `@r${i}`).join(",")})`,
        params);
    for (const l of links) map.get(l.ReviewId)?.push({ id: l.Id, name: l.Name });
    return map;
}

const toPublic = (r, designs) => ({
    id: r.Id,
    username: r.Username,
    rating: r.Rating,
    comment: r.Comment,
    createdAt: iso(r.CreatedAt),
    designs: designs.get(r.Id) || [],
});

/* ---------- PUBLIC: visible reviews (home page, or one design) ---------- */
export async function listPublic({ designId, page = 1, limit = 6 }) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 50);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

    const filter = designId
        ? `r.Hidden = 0 AND EXISTS (SELECT 1 FROM mehndi.ReviewDesigns rd WHERE rd.ReviewId = r.Id AND rd.DesignId = @d)`
        : `r.Hidden = 0`;
    const params = designId ? { d: designId } : {};

    const stats = await query(
        `SELECT COUNT(*) AS N, AVG(CAST(r.Rating AS FLOAT)) AS Average FROM mehndi.Reviews r WHERE ${filter}`, params);

    // ROW_NUMBER paging works on every SQL Server version (incl. 2008 R2)
    const rows = await query(
        `SELECT * FROM (
             SELECT r.*, ROW_NUMBER() OVER (ORDER BY r.CreatedAt DESC) AS rn
             FROM mehndi.Reviews r WHERE ${filter}
         ) x WHERE x.rn > @skip AND x.rn <= @upto ORDER BY x.rn`,
        { ...params, skip, upto: skip + lim });

    const designs = await attachDesigns(rows);
    const count = stats[0].N;
    return {
        count,
        average: count ? Math.round(stats[0].Average * 10) / 10 : 0,
        page: Math.floor(skip / lim) + 1,
        hasMore: skip + rows.length < count,
        items: rows.map((r) => toPublic(r, designs)),
    };
}

/* ---------- Customer ---------- */
export async function listMine(userId) {
    const rows = await query(`SELECT * FROM mehndi.Reviews WHERE UserId = @u ORDER BY CreatedAt DESC`, { u: userId });
    return rows.map((r) => ({
        id: r.Id, orderId: r.OrderId, rating: r.Rating, comment: r.Comment,
        hidden: r.Hidden === true, createdAt: iso(r.CreatedAt),
    }));
}

function validate(rating, comment) {
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("Please choose a rating from 1 to 5 stars");
    const text = String(comment ?? "").trim();
    if (text.length > 1000) throw new Error("Review is too long (max 1000 characters)");
    return { rating: n, comment: text };
}

export async function createReview({ user, orderId, rating, comment }) {
    const v = validate(rating, comment);
    const id = crypto.randomUUID();

    const ctx = await withTransaction(async (tx) => {
        const orders = await query(
            `SELECT o.Id, o.UserId, o.Status, o.Username, o.IndustryKey, e.OwnerId
             FROM mehndi.Orders o WITH (UPDLOCK, ROWLOCK)
             LEFT JOIN mehndi.Events e ON e.Id = o.EventId
             WHERE o.Id = @o`, { o: orderId }, tx);
        const o = orders[0];
        if (!o) throw new Error("Order not found");
        if (o.UserId !== user.id) throw new Error("You can only review your own orders");
        if (o.Status !== "completed") throw new Error("You can review an order once it is completed");

        const dup = await query(`SELECT Id FROM mehndi.Reviews WHERE OrderId = @o`, { o: orderId }, tx);
        if (dup[0]) throw new Error("You have already reviewed this order");

        await query(
            `INSERT INTO mehndi.Reviews (Id, OrderId, UserId, Username, Rating, Comment)
             VALUES (@id, @o, @u, @n, @rt, @c)`,
            { id, o: orderId, u: user.id, n: o.Username, rt: v.rating, c: v.comment }, tx);

        // link the review to every catalogue design that was in the order
        await query(
            `INSERT INTO mehndi.ReviewDesigns (ReviewId, DesignId)
             SELECT @id, d.Id FROM mehndi.Designs d
             WHERE d.Id IN (SELECT DesignId FROM mehndi.OrderItems WHERE OrderId = @o AND DesignId IS NOT NULL)`,
            { id, o: orderId }, tx);

        return { ownerId: o.OwnerId, industryKey: o.IndustryKey, username: o.Username };
    });
    return { review: await getOne(id), ...ctx };
}

async function getOne(id) {
    const rows = await query(`SELECT * FROM mehndi.Reviews WHERE Id = @id`, { id });
    if (!rows[0]) return null;
    const designs = await attachDesigns(rows);
    return { ...toPublic(rows[0], designs), orderId: rows[0].OrderId, hidden: rows[0].Hidden === true };
}

export async function updateMyReview({ user, id, rating, comment }) {
    const v = validate(rating, comment);
    const rows = await query(`SELECT UserId FROM mehndi.Reviews WHERE Id = @id`, { id });
    if (!rows[0]) throw new Error("Review not found");
    if (rows[0].UserId !== user.id) throw new Error("Forbidden");
    await query(
        `UPDATE mehndi.Reviews SET Rating=@r, Comment=@c, UpdatedAt=SYSUTCDATETIME() WHERE Id=@id`,
        { id, r: v.rating, c: v.comment });
    return getOne(id);
}

export async function deleteMyReview({ user, id }) {
    const rows = await query(`SELECT UserId FROM mehndi.Reviews WHERE Id = @id`, { id });
    if (!rows[0]) throw new Error("Review not found");
    if (rows[0].UserId !== user.id) throw new Error("Forbidden");
    await query(`DELETE FROM mehndi.Reviews WHERE Id = @id`, { id });
    return { ok: true };
}

/* ---------- Admin moderation ---------- */
/** SuperAdmin → all reviews. Admin → reviews of orders on their own events. */
export async function listForAdmin(user) {
    const scoped = user.role !== "SUPERADMIN";
    const rows = await query(
        `SELECT r.*, e.Name AS EventName
         FROM mehndi.Reviews r
         JOIN mehndi.Orders o ON o.Id = r.OrderId
         LEFT JOIN mehndi.Events e ON e.Id = o.EventId
         ${scoped ? `WHERE ${adminOrderScope("o")}` : ""}
         ORDER BY r.CreatedAt DESC`,
        scoped ? { me: user.id } : {});
    const designs = await attachDesigns(rows);
    return rows.map((r) => ({
        ...toPublic(r, designs),
        orderId: r.OrderId,
        hidden: r.Hidden === true,
        eventName: r.EventName || null,
    }));
}

export async function setHidden({ user, id, hidden }) {
    const rows = await query(`SELECT OrderId FROM mehndi.Reviews WHERE Id = @id`, { id });
    if (!rows[0]) throw Object.assign(new Error("Review not found"), { status: 404 });
    const { allowed } = await adminCanAccessOrder(user, rows[0].OrderId);
    if (!allowed) throw Object.assign(new Error("This review belongs to another admin's event"), { status: 403 });
    await query(`UPDATE mehndi.Reviews SET Hidden = @h WHERE Id = @id`, { id, h: Boolean(hidden) });
    return getOne(id);
}
